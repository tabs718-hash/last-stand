import type R from '@dimforge/rapier3d-compat';
import {Euler,Quaternion,Vector3} from 'three';
import type {Part,Muscle} from './CharacterTypes';
import type {BalanceController} from './BalanceController';
import {RECOVERY} from '../config/behaviour';
export type BodyMode='standing'|'recovering'|'falling'|'grounded'|'unconscious'|'passive';
export class BodyPoseController {
  mode:BodyMode='standing';
  brace=0;
  groundTime=0;
  groundContacts:string[]=[];
  armMode:'idle'|'brace'|'support'='idle';
  grounded=false;
  guardingWeapon=false;
  aimTarget=new Vector3(0,1.15,12);
  aimDirection=new Vector3(0,0,1);
  constructor(private world:R.World,private ground:R.Collider,private parts:Part[],private balance:BalanceController){}
  private part(name:string){return this.parts.find(p=>p.name===name)!}
  update(dt:number,consciousness:number,active:boolean){
    this.groundContacts=[];this.guardingWeapon=false;
    for(const part of this.parts.filter(p=>/Pelvis|Abdomen|Chest|forearm|hand/.test(p.name))){
      let touching=false;
      this.world.contactPair(part.body.collider(0),this.ground,manifold=>{
        for(let i=0;i<manifold.numSolverContacts();i++)if(manifold.solverContactDist(i)<.003)touching=true;
      });
      if(touching)this.groundContacts.push(part.name);
    }
    const pelvis=this.part('Pelvis').body.translation(),chest=this.part('Chest').body;
    const upright=new Vector3(0,1,0).applyQuaternion(new Quaternion().copy(chest.rotation())).y;
    const low=pelvis.y<RECOVERY.groundEnterHeight;
    const torsoContact=this.groundContacts.some(n=>/Pelvis|Abdomen|Chest/.test(n));
    this.groundTime=low&&torsoContact?this.groundTime+dt:Math.max(0,this.groundTime-dt*2);
    if(this.groundTime>.10)this.grounded=true;
    if(pelvis.y>.78&&upright>.7)this.grounded=false;
    const threatened=low||upright<.6||this.balance.state==='recovering'||this.balance.velocity.clone().setY(0).length()>.18;
    if(!active||consciousness<.15){this.mode=active?'unconscious':'passive';this.brace=0;this.armMode='idle';return}
    this.mode=this.grounded?'grounded':low||upright<.6?'falling':threatened?'recovering':'standing';
    const desired=threatened?1:0;
    this.brace+=(desired-this.brace)*(1-Math.exp(-dt*(desired?12:3)));
    this.armMode=this.mode==='grounded'?'support':this.brace>.05?'brace':'idle';
  }
  pose(muscle:Muscle,aiming:boolean,gunPosition:Vector3,armed:boolean,gripFrame=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.75)){
    muscle.stateActivation=1;
    if(this.mode==='unconscious'||this.mode==='passive')return;
    const name=muscle.b.name;
    if(this.mode==='grounded'){
      muscle.balanceTorque.set(0,0,0);
      if(/thigh|shin|foot/.test(name)){
        muscle.stateActivation=.18;
        muscle.desired.setFromAxisAngle(new Vector3(1,0,0),name.includes('thigh')?-.30:name.includes('shin')?.65:-.25);
      }
      if(name==='Abdomen'||name==='Chest'){muscle.stateActivation=.35;muscle.desired.identity()}
      if(name.startsWith('Left')&&/upper arm|forearm|hand/.test(name)){
        muscle.stateActivation=.65;
        if(name.includes('upper arm')){
          const global=new Quaternion().setFromUnitVectors(new Vector3(0,-1,0),new Vector3(-.35,-.7,.35).normalize());
          muscle.desired.copy(new Quaternion().copy(muscle.a.body.rotation()).invert().multiply(global));
        }else muscle.desired.setFromAxisAngle(new Vector3(1,0,0),name.includes('forearm')?-.35:.15);
      }
      if(aiming&&name.startsWith('Right')&&/upper arm|forearm|hand/.test(name))this.groundAim(muscle,gunPosition,gripFrame);
      return;
    }
    if(this.brace>.02&&this.mode!=='falling'&&armed&&!aiming&&name.startsWith('Right')&&/upper arm|forearm|hand/.test(name)){
      this.guardingWeapon=true;muscle.targetRate=2;
      const pitch=name.includes('upper arm')?-.35:name.includes('forearm')?-.25:.2;
      const guard=name.includes('upper arm')?new Quaternion().setFromEuler(new Euler(pitch,0,.3)):new Quaternion().setFromAxisAngle(new Vector3(1,0,0),pitch);
      muscle.desired.slerp(guard,this.brace);
    }
    if(this.brace>.02&&name.startsWith('Left')&&/upper arm|forearm|hand/.test(name)){
      const side=Math.max(-.6,Math.min(.6,this.balance.velocity.x*.7));
      const target=name.includes('upper arm')?new Quaternion().setFromEuler(new Euler(-.9,0,side)):new Quaternion().setFromAxisAngle(new Vector3(1,0,0),name.includes('forearm')?-.45:.2);
      muscle.desired.slerp(target,this.brace);
    }
  }
  private groundAim(muscle:Muscle,gunPosition:Vector3,gripFrame:Quaternion){
    this.aimDirection.copy(this.aimTarget).sub(gunPosition).normalize();
    const yaw=Math.atan2(this.aimDirection.x,this.aimDirection.z);
    const pitch=Math.asin(this.aimDirection.y);
    const upperWorld=new Quaternion().setFromEuler(new Euler(-Math.PI/2-.05,yaw,0,'YXZ'));
    if(muscle.b.name==='Right upper arm')muscle.desired.copy(new Quaternion().copy(muscle.a.body.rotation()).invert().multiply(upperWorld));
    if(muscle.b.name==='Right forearm')muscle.desired.identity();
    if(muscle.b.name==='Right hand'){
      const gunWorld=new Quaternion().setFromEuler(new Euler(-pitch,yaw,0,'YXZ'));
      const handWorld=gunWorld.multiply(gripFrame.clone().invert());
      const relative=new Quaternion().copy(muscle.a.body.rotation()).invert().multiply(handWorld);
      const angles=new Euler().setFromQuaternion(relative,'XYZ');
      muscle.desired.setFromEuler(new Euler(Math.max(-.8,Math.min(.8,angles.x)),Math.max(-.5,Math.min(.5,angles.y)),Math.max(-.5,Math.min(.5,angles.z))));
    }
  }
}
