import {HeadFragments} from '../combat/HeadFragments';
import R from '@dimforge/rapier3d-compat';
import {Euler,Matrix4,Quaternion,Vector3} from 'three';
import {FIXED_DT,PHYSICS_DT,PHYSICS_SUBSTEPS,GRAVITY,muscleProfile} from '../config/ragdoll';
import {BalanceController} from './BalanceController';
import {BodyPoseController} from './BodyPoseController';
import {RecoveryStepController} from './RecoveryStepController';
import type {InitialPose} from '../config/behaviour';
import {SupportDetector} from './SupportDetector';
import {MuscleController} from './MuscleController';
import type {Part,Muscle} from './CharacterTypes';
import {setSphericalLimits,anatomicalRanges} from '../physics/JointLimits';
import {CollisionRegistry,bodyZone} from '../physics/CollisionRegistry';
import {WEAPON_PROFILES} from '../combat/WeaponProfiles';
import {BallisticsSystem,SHOT_ENERGY,type EnergyMode} from '../combat/BallisticsSystem';
import {DamageSystem} from '../combat/DamageSystem';
import {HolsterDrawController} from './HolsterDrawController';
import {GripController} from '../combat/GripController';
import {hitboxSize} from '../config/hitboxes';
import {InjuryModel} from '../combat/InjuryModel';
export type {Part} from './CharacterTypes';
export const DT=FIXED_DT;

export class Rig {
  world:R.World;
  fragments:HeadFragments;
  ground:R.Collider;
  parts:Part[]=[];
  readonly bindPose=new Map<string,Matrix4>();
  muscles:Muscle[]=[];
  balance:BalanceController;
  controller:MuscleController;
  behaviour:BodyPoseController;
  recoveryStep:RecoveryStepController;
  active=true;
  strength=1;
  timings={controller:0,world:0};
  time=0;
  steps=0;
  registry=new CollisionRegistry();
  ballistics:BallisticsSystem;
  injuries:InjuryModel;
  grip:GripController;
  draw:HolsterDrawController;
  damage:DamageSystem;
  energyMode:EnergyMode='HIGH';
  private commands:(()=>void)[]=[];
  consciousActivation=1;
  aiming=false;
  aimPitch=0;
  aimYaw=0;
  commandLog:Record<string,unknown>[]=[];
  initialBodies:unknown[]=[];

  constructor(public initialPose:InitialPose='standing',holstered=false){
    this.world=new R.World({x:0,y:-GRAVITY,z:0});
    this.world.timestep=PHYSICS_DT;
    this.world.numSolverIterations=12;
    this.fragments=new HeadFragments(this.world);
    this.ground=this.world.createCollider(R.ColliderDesc.cuboid(100,.1,100).setTranslation(0,-.1,0).setFriction(1.1).setCollisionGroups((2<<16)|0xffff));
    this.createSkeleton();
    this.grip=new GripController(this.world,this.part('Right hand'),this.part('Head'),this.part('Pelvis'),holstered&&initialPose==='standing');
    // The forearm and gun grip are adjacent parts; their simplified proxies overlap at the wrist.
    this.part('Right forearm').body.collider(0).setCollisionGroups((8<<16)|(0xffff^4));
    this.part('Right hand').body.collider(0).setCollisionGroups((32<<16)|(0xffff^4));
    this.grip.weapon.collider(0).setCollisionGroups((4<<16)|0xffff);
    for(const p of this.parts)this.bindPose.set(p.name,new Matrix4().compose(new Vector3().copy(p.body.translation()),new Quaternion().copy(p.body.rotation()),new Vector3(1,1,1)));
    if(initialPose==='supine')this.initializeSupine();
    this.draw=new HolsterDrawController(this.parts,this.grip);
    this.injuries=new InjuryModel(this.parts);
    this.damage=new DamageSystem(this.injuries,this.grip,(head,direction)=>{this.fragments.burst(head,direction);head.destroyed=true;head.functionality=0;head.body.collider(0).setSensor(true);head.body.collider(0).setMass(.001);head.body.recomputeMassPropertiesFromColliders();for(const entry of this.registry.entries.values())if(entry.part===head)entry.collider.setEnabled(false);this.grip.dropHat()});
    this.balance=new BalanceController(this.parts,new SupportDetector(this.world,this.ground,this.parts),()=>this.grip.props.filter(p=>p.name==='Revolver'?this.grip.secured:p.name==='Holster'?true:this.grip.hatJoint!==null));
    this.behaviour=new BodyPoseController(this.world,this.ground,this.parts,this.balance);
    this.recoveryStep=new RecoveryStepController(this.parts,this.muscles,this.balance);
    for(const part of this.parts){
      const size=hitboxSize(part.name,part.size);
      const collider=this.world.createCollider(R.ColliderDesc.cuboid(size[0]/2,size[1]/2,size[2]/2).setSensor(true).setDensity(0),part.body);
      this.registry.add({id:part.name,actor:'opponent',collider,body:part.body,part,zone:bodyZone(part.name),size,resistance:900,surfaceLoss:6,coreResistance:part.name==='Head'?4500:part.name.includes('shin')?4000:1300});
    }
    for(const part of this.grip.props)this.registry.add({id:part.name,collider:part.body.collider(0),body:part.body,zone:part.name==='Revolver'?'weapon':part.name==='Hat'?'hat':'environment',size:part.size,resistance:part.name==='Revolver'?18000:150,surfaceLoss:2,coreResistance:0});
    this.registry.add({id:'ground',collider:this.ground,zone:'environment',size:[200,.2,200],resistance:8000,surfaceLoss:30,coreResistance:0});
    this.grip.contactName=collider=>this.registry.get(collider.handle)?.id??'environment';
    this.ballistics=new BallisticsSystem(this.world,this.registry);
    this.initialBodies=this.allParts.map(p=>({name:p.name,size:p.size,mass:p.mass,position:{...p.body.translation()},rotation:{...p.body.rotation()}}));
    this.controller=new MuscleController(this.muscles,()=>this.grip.held?[this.grip.props[0]]:[]);
  }

  get com(){return this.balance.com}
  get contacts(){return this.balance.support.feet.length}
  part(name:string){const p=this.parts.find(p=>p.name===name);if(!p)throw Error('Unknown body: '+name);return p}

  private add(name:string,x:number,y:number,z:number,size:[number,number,number],mass:number){
    const body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x,y,z)
      .setLinearDamping(.12).setAngularDamping(.35).setCanSleep(false));
    this.world.createCollider(R.ColliderDesc.cuboid(size[0]/2,size[1]/2,size[2]/2).setMass(mass).setFriction(1.1),body);
    const part:Part={name,body,size,mass,previous:new Vector3(x,y,z),previousQ:new Quaternion(),functionality:1};
    this.parts.push(part);
    return part;
  }

  private link(a:Part,b:Part,position:Vector3,hinge=false,maxTorque=90){
    const aa=position.clone().sub(a.body.translation()),bb=position.clone().sub(b.body.translation());
    const desc=hinge?R.JointData.revolute(aa,bb,{x:1,y:0,z:0}):R.JointData.spherical(aa,bb);
    const joint=this.world.createImpulseJoint(desc,a.body,b.body,true);
    joint.setContactsEnabled(false);
    if(hinge){
      const knee=b.name.includes('shin');
      (joint as R.RevoluteImpulseJoint).setLimits(knee?-.03:-2.5,knee?2.35:.03);
    }
    if(!hinge)setSphericalLimits(this.world,joint,anatomicalRanges(b.name));
    const inertia=b.body.principalInertia();
    this.muscles.push({a,b,joint,hinge,stateActivation:1,targetRate:1,profile:muscleProfile(b.name,Math.min(inertia.x,inertia.y,inertia.z),maxTorque),
      target:new Quaternion(),desired:new Quaternion(),torque:new Vector3(),balanceTorque:new Vector3(),angleError:0,limit:0});
  }

  private createSkeleton(){
    const pelvis=this.add('Pelvis',0,.98,0,[.29,.19,.21],12);
    const abdomen=this.add('Abdomen',0,1.16,0,[.25,.17,.19],8);
    const chest=this.add('Chest',0,1.37,0,[.38,.25,.22],19);
    const head=this.add('Head',0,1.66,0,[.18,.23,.19],5);
    this.link(pelvis,abdomen,new Vector3(0,1.08,0));
    this.link(abdomen,chest,new Vector3(0,1.25,0));
    this.link(chest,head,new Vector3(0,1.52,0),false,35);
    for(const s of [-1,1]){
      const side=s<0?'Left':'Right';
      const thigh=this.add(side+' thigh',s*.17,.72,0,[.15,.35,.16],7.5);
      const shin=this.add(side+' shin',s*.17,.36,0,[.12,.35,.13],3.5);
      const foot=this.add(side+' foot',s*.17,.075,.055,[.17,.15,.36],1.2);
      this.link(pelvis,thigh,new Vector3(s*.17,.90,0),false,140);
      this.link(thigh,shin,new Vector3(s*.17,.54,0),true,110);
      this.link(shin,foot,new Vector3(s*.17,.15,0),false,130);
      const upper=this.add(side+' upper arm',s*.32,1.30,0,[.12,.29,.13],2.1);
      const forearm=this.add(side+' forearm',s*.32,1.02,0,[.10,.25,.11],1.3);
      const hand=this.add(side+' hand',s*.32,.83,0,[.10,.13,.07],.5);
      this.link(chest,upper,new Vector3(s*.26,1.45,0),false,45);
      this.link(upper,forearm,new Vector3(s*.32,1.15,0),true,30);
      this.link(forearm,hand,new Vector3(s*.32,.89,0),false,15);
    }
  }

  private initializeSupine(){
    // Initial conditions only, before the first simulation step; joints remain connected.
    const pivot=new Vector3(0,.98,0),origin=new Vector3(0,.125,0);
    const rotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);
    for(const part of this.allParts){
      const position=new Vector3().copy(part.body.translation()).sub(pivot).applyQuaternion(rotation).add(origin);
      const orientation=rotation.clone().multiply(new Quaternion().copy(part.body.rotation()));
      part.body.setTranslation(position,true);part.body.setRotation(orientation,true);
      part.previous.copy(position);part.previousQ.copy(orientation);
    }
  }

  get allParts(){return [...this.parts,...this.grip.props]}
  queue(command:()=>void){this.commands.push(command)}

  testShot(target:'knee'|'hand'|'weapon'|'head'|'torso'|'leftArm'|'rightArm'|'leftLeg'|'rightLeg',mode:EnergyMode=this.energyMode){
    this.queue(()=>{
      this.commandLog.push({step:this.steps,type:'testShot',target,mode});
      const part=target==='weapon'?this.grip.weapon:this.part(target==='knee'||target==='rightLeg'?'Right shin':target==='leftLeg'?'Left shin':target==='leftArm'?'Left upper arm':target==='rightArm'?'Right upper arm':target==='hand'?'Right hand':target==='head'?'Head':'Chest').body;
      const point=new Vector3().copy(part.translation());
      if(target==='hand')point.add(new Vector3(0,.055,-.01).applyQuaternion(new Quaternion().copy(part.rotation())));
      if(target==='knee')point.add(new Vector3(0,.126,0).applyQuaternion(new Quaternion().copy(part.rotation())));
      const approach=(target==='hand'?new Vector3(3,0,1):new Vector3(0,0,3)).applyQuaternion(new Quaternion().copy(part.rotation()));
      const origin=point.clone().add(approach);
      // Debug shots still use real occlusion: never start a downward-facing gun test below the floor.
      origin.y=Math.max(.2,origin.y);
      const shot=this.ballistics.shoot(origin,point.sub(origin).normalize(),SHOT_ENERGY[mode],this.time,new Set(),WEAPON_PROFILES[mode].penetration);
      this.damage.resolve(shot.hits);
    });
  }

  impulse(power=2){
    this.commandLog.push({step:this.steps,type:'impulse',power});
    const chest=this.part('Chest').body;
    chest.applyImpulseAtPoint({x:power,y:0,z:.3},new Vector3().copy(chest.translation()).add(new Vector3(0,.08,0)),true);
  }

  step(){
    for(const command of this.commands.splice(0))command();
    for(const p of this.allParts){p.previous.copy(p.body.translation());p.previousQ.copy(p.body.rotation())}
    this.timings={controller:0,world:0};
    // One game tick, four shared physics/controller substeps. No independent clocks.
    for(let sub=0;sub<PHYSICS_SUBSTEPS;sub++){
      const started=performance.now();
      for(const p of this.allParts)p.body.resetTorques(true);
      this.consciousActivation+=(this.injuries.consciousness-this.consciousActivation)*(1-Math.exp(-PHYSICS_DT*15));
      this.injuries.update(PHYSICS_DT);
      // Leg wounds keep active balance and healthy muscles while support fails progressively.
      this.grip.update(this.injuries.consciousness);
      this.balance.update(PHYSICS_DT);
      this.behaviour.update(PHYSICS_DT,this.injuries.consciousness,this.active);
      this.recoveryStep.update(PHYSICS_DT,this.active&&(!this.injuries.forcedCollapse||this.injuries.collapseAge<.45)&&this.consciousActivation>.3&&!this.behaviour.grounded&&this.part('Pelvis').body.translation().y>.72);
      this.draw.update(this.time+sub*PHYSICS_DT,this.active&&this.injuries.consciousness>.3);
      for(const muscle of this.muscles){
        muscle.targetRate=1;
        this.balance.pose(muscle);
        this.recoveryStep.pose(muscle);
        if(this.aiming&&this.grip.held&&!this.behaviour.grounded){
          if(muscle.b.name==='Right upper arm')muscle.desired.setFromEuler(new Euler(-.9,this.aimYaw,0));
          if(muscle.b.name==='Right forearm')muscle.desired.setFromAxisAngle(new Vector3(1,0,0),-.65+this.aimPitch);
          if(muscle.b.name==='Right hand')muscle.desired.setFromAxisAngle(new Vector3(1,0,0),1.55-new Euler().setFromQuaternion(this.grip.handFrame).x);
        }
        this.behaviour.pose(muscle,this.aiming&&this.grip.held,new Vector3().copy(this.grip.weapon.translation()),this.grip.held,this.grip.handFrame);
        this.draw.pose(muscle);
        muscle.stateActivation*=this.injuries.reactionActivation(muscle.b.name);
        const flinch=this.injuries.reactionAmount(muscle.b.name),direction=this.injuries.reactionDirections.get(muscle.b.name);
        if(flinch>0&&direction){
          const local=direction.clone().applyQuaternion(new Quaternion().copy(muscle.a.body.rotation()).invert());
          const along=new Vector3(0,-1,0).applyQuaternion(muscle.desired),axis=new Vector3().crossVectors(along,local);
          if(axis.lengthSq()>.001)muscle.desired.premultiply(new Quaternion().setFromAxisAngle(axis.normalize(),.48*flinch));
        }
        if(this.injuries.forcedCollapse&&/thigh|shin|foot/.test(muscle.b.name)&&!this.behaviour.grounded){
          const age=this.injuries.collapseAge,injured=this.injuries.injuredLegs.has(muscle.b.name),fail=Math.max(0,Math.min(1,(age-.28)/.95));
          muscle.balanceTorque.multiplyScalar(1-.85*fail);
          const bend=muscle.b.name.includes('shin')?(injured?1.2:.58):muscle.b.name.includes('thigh')?(injured?-.5:-.24):-.12;
          const bracing=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),bend);
          muscle.desired.slerp(bracing,fail);muscle.stateActivation*=injured?.8:.9;
          if(injured&&age<.5&&muscle.b.name.includes('shin'))muscle.desired.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.65*Math.sin(Math.PI*age/.5)));
          if(injured&&age<.5&&muscle.b.name.includes('foot'))muscle.stateActivation*=.35;
          // The impact initially drives the struck leg along the bullet; the other leg keeps bracing.
          const impact=this.injuries.reactionDirections.get(muscle.b.name);
          if(injured&&impact&&age<.5&&muscle.b.name.includes('thigh')){
            const local=impact.clone().applyQuaternion(new Quaternion().copy(muscle.a.body.rotation()).invert()),axis=new Vector3(0,-1,0).cross(local);
            if(axis.lengthSq()>.001)muscle.desired.premultiply(new Quaternion().setFromAxisAngle(axis.normalize(),.35*Math.sin(Math.PI*age/.5)));
          }
        }
      }
      this.controller.update(PHYSICS_DT,this.active?this.strength*this.consciousActivation:0);
      const solveStarted=performance.now();
      this.timings.controller+=solveStarted-started;
      this.world.step();
      this.timings.world+=performance.now()-solveStarted;
    }
    this.balance.update(PHYSICS_DT);
    this.time+=DT;this.steps++;
  }

  dispose(){this.world.free()}
}
