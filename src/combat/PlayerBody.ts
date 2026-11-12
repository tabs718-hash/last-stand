import R from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import type {CollisionRegistry,HitZone} from '../physics/CollisionRegistry';
import type {HitEvent} from './PenetrationSolver';
import {VitalState,isArm,isLeg} from './VitalState';
/** FPS collision body: stable capsule stance, released into physical fall on leg injury/death. */
export class PlayerBody {
 body:R.RigidBody;support:R.Collider;vitals=new VitalState();fallen=false;
 hitboxes:R.Collider[]=[];cameraJolt=new Vector3();
 constructor(private world:R.World,registry:CollisionRegistry,distance=12){
  this.body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,.93,distance).enabledRotations(false,true,false).setLinearDamping(1).setAngularDamping(1));
  this.support=world.createCollider(R.ColliderDesc.capsule(.68,.25).setMass(76.2).setFriction(1).setCollisionGroups((256<<16)|2),this.body);
  const boxes:[string,HitZone,[number,number,number],[number,number,number]][]=[
   ['head','head',[0,.72,0],[.20,.24,.21]],['chest','chest',[0,.42,0],[.43,.26,.28]],['abdomen','abdomen',[0,.20,0],[.35,.18,.26]],['pelvis','pelvis',[0,0,0],[.37,.22,.26]],
  ];
  for(const [side,x] of [['Left',-.30],['Right',.30]] as const){
   boxes.push([side+' upper arm','upperArm',[x,.36,0],[.15,.30,.15]],[side+' forearm','forearm',[x,.08,.03],[.13,.26,.14]],[side+' hand','hand',[x,-.10,.04],[.12,.16,.10]],
    [side+' thigh','thigh',[Math.sign(x)*.16,-.23,0],[.20,.34,.20]],[side+' shin','shin',[Math.sign(x)*.16,-.57,0],[.16,.34,.15]],[side+' foot','foot',[Math.sign(x)*.16,-.85,-.04],[.18,.15,.34]]);
  }
  for(const [name,zone,p,size] of boxes){const c=world.createCollider(R.ColliderDesc.cuboid(size[0]/2,size[1]/2,size[2]/2).setTranslation(...p).setSensor(true).setDensity(0),this.body);this.hitboxes.push(c);registry.add({id:'player '+name,actor:'player',collider:c,body:this.body,zone,size,resistance:900,surfaceLoss:6,coreResistance:1300})}
 }
 resolve(hits:HitEvent[]){
  const primary=hits.find(h=>h.entry.actor==='player'&&h.depositedEnergy>0);if(!primary)return null;
  this.vitals.apply(primary.zone,primary.shotId,primary.depositedEnergy);
  if((hits.some(h=>h.entry.actor==='player'&&h.depositedEnergy>0&&isLeg(h.zone))||!this.vitals.alive)&&!this.fallen){this.fallen=true;this.body.setEnabledRotations(true,true,true,true);this.support.setShape(new R.Capsule(.12,.25));this.body.wakeUp()}
  for(const h of hits.filter(h=>h.entry.actor==='player'))(h.zone==='weapon'&&h.entry.body?h.entry.body:this.body).applyImpulseAtPoint(h.impulse,h.entryPoint,true);
  if(isArm(primary.zone))this.cameraJolt.copy(primary.impulse).multiplyScalar(.018);
  return primary;
 }
 update(dt:number){this.cameraJolt.multiplyScalar(Math.exp(-dt*10))}
 eye(){return new Vector3(0,.72,0).applyQuaternion(new Quaternion().copy(this.body.rotation())).add(this.body.translation()).add(this.cameraJolt)}
 target(){return new Vector3(0,.27,0).applyQuaternion(new Quaternion().copy(this.body.rotation())).add(this.body.translation())}
}
