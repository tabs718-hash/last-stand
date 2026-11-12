import R from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {weaponPose,smoothstep} from '../input/WeaponPresentation';
/** FPS hands are kinematic presentation bodies; gun and holster remain dynamic constrained props. */
export class PlayerEquipment {
 waist:R.RigidBody;holster:R.RigidBody;gun:R.RigidBody;hand:R.RigidBody;
 mount:R.ImpulseJoint|null;handJoint:R.ImpulseJoint|null=null;
 dropped=false;cameraPosition=new Vector3(0,1.65,12);cameraRotation=new Quaternion();ads=0;recoil=0;ready=false;
 previous={gun:new Vector3(),holster:new Vector3(),hand:new Vector3()};
 previousQ={gun:new Quaternion(),holster:new Quaternion(),hand:new Quaternion()};
 constructor(private world:R.World,waist?:R.RigidBody){
  const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI);
  this.waist=waist??world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(0,.98,12));
  const wp=this.waist.translation();this.cameraPosition.set(wp.x,wp.y+.72,wp.z);this.holster=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(wp.x+.31,wp.y-.13,wp.z-.1).setRotation(q));
  for(const [x,y,z,w,h,d] of [[-.047,0,.02,.008,.28,.11],[.047,0,.02,.008,.28,.11],[0,0,-.025,.09,.28,.008],[0,0,.085,.09,.28,.008],[0,-.145,.025,.09,.01,.11]])world.createCollider(R.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z).setMass(.044).setCollisionGroups((64<<16)|2),this.holster);
  world.createImpulseJoint(R.JointData.fixed({x:.31,y:-.13,z:-.1},q,{x:0,y:0,z:0},new Quaternion()),this.waist,this.holster,true).setContactsEnabled(false);
  const gunQ=q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2));
  this.gun=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(wp.x+.31,wp.y-.085,wp.z-.1).setRotation(gunQ).setCcdEnabled(true));
  world.createCollider(R.ColliderDesc.cuboid(.04,.075,.17).setMass(1.05).setCollisionGroups((128<<16)|2),this.gun);
  this.mount=world.createImpulseJoint(R.JointData.fixed({x:0,y:.045,z:0},new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2),{x:0,y:0,z:0},new Quaternion()),this.holster,this.gun,true);this.mount!.setContactsEnabled(false);
  this.hand=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(wp.x+.43,wp.y+.25,wp.z-.1).setRotation(gunQ));
  for(const key of ['gun','holster','hand'] as const){this.previous[key].copy(this[key].translation());this.previousQ[key].copy(this[key].rotation())}
 }
 get holstered(){return this.mount!==null}
 get held(){return this.handJoint!==null}
 drop(){if(this.handJoint)this.world.removeImpulseJoint(this.handJoint,true);if(this.mount)this.world.removeImpulseJoint(this.mount,true);this.handJoint=null;this.mount=null;this.dropped=true;this.ready=false}
 snapshotPrevious(){for(const key of ['gun','holster','hand'] as const){this.previous[key].copy(this[key].translation());this.previousQ[key].copy(this[key].rotation())}}
 update(progress:number){
  if(this.dropped){this.ready=false;return}
  const gp=new Vector3().copy(this.gun.translation()),gq=new Quaternion().copy(this.gun.rotation());
  if(!this.handJoint){
   const t=smoothstep(progress/.22),target=new Vector3(.43,.25,-.1).add(this.waist.translation()).lerp(gp,t);
   this.hand.setNextKinematicTranslation(target);this.hand.setNextKinematicRotation(gq);
   if(progress>=.22&&new Vector3().copy(this.hand.translation()).distanceTo(gp)<.025){
    const hq=new Quaternion().copy(this.hand.rotation()),anchor=gp.clone().sub(this.hand.translation()).applyQuaternion(hq.clone().invert());
    this.world.removeImpulseJoint(this.mount!,true);this.mount=null;
    this.handJoint=this.world.createImpulseJoint(R.JointData.fixed(anchor,hq.invert().multiply(gq),{x:0,y:0,z:0},new Quaternion()),this.hand,this.gun,true);this.handJoint.setContactsEnabled(false);
   }
   this.ready=false;return;
  }
  const t=Math.max(0,Math.min(1,(progress-.22)/.78));
  const socket=new Vector3(0,.045,0).applyQuaternion(new Quaternion().copy(this.holster.rotation())).add(this.holster.translation());
  const final=weaponPose(this.cameraPosition,this.cameraRotation,1,this.ads,this.recoil);
  final.position.y=Math.max(.12,final.position.y);
  const extract=socket.clone().add(new Vector3(0,.32,-.025));
  const position=t<.38?socket.clone().lerp(extract,smoothstep(t/.38)):extract.lerp(final.position,smoothstep((t-.38)/.62));
  const socketQ=new Quaternion().copy(this.holster.rotation()).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2));
  const rotation=socketQ.slerp(final.rotation,smoothstep((t-.28)/.72));
  this.hand.setNextKinematicTranslation(position);this.hand.setNextKinematicRotation(rotation);
  this.ready=progress>=1&&gp.distanceTo(final.position)<.05;
 }
 muzzle(){return new Vector3(0,.025,.178).applyQuaternion(new Quaternion().copy(this.gun.rotation())).add(this.gun.translation())}
}
