import R from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import type {Part} from '../character/CharacterTypes';
import {PHYSICS_DT} from '../config/ragdoll';
export class GripController {
  weapon:R.RigidBody;
  hat:R.RigidBody;
  weaponJoint:R.ImpulseJoint|null;
  hatJoint:R.ImpulseJoint|null;
  handFrame=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.75);
  holsterJoint:R.ImpulseJoint|null=null;
  holster:R.RigidBody|null=null;
  holsterMount:R.ImpulseJoint|null=null;
  private pelvis?:Part;
  maxForce=180;
  maxTorque=8;
  gripStrength=1;
  releaseReason='';
  peakLoad={force:0,torque:0};
  props:Part[]=[];
  contactName:(collider:R.Collider)=>string=collider=>collider.parent()?'body':'ground';
  constructor(private world:R.World,private hand:Part,private head:Part,pelvis?:Part,holstered=false){
    this.pelvis=pelvis;
    const handPosition=hand.body.translation();
    const gripRotation=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.75);
    const handAnchor=new Vector3(0,-.025,.04),weaponAnchor=new Vector3(0,0,-.09);
    const weaponPosition=new Vector3().copy(handPosition).add(handAnchor).sub(weaponAnchor.clone().applyQuaternion(gripRotation));
    this.weapon=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(weaponPosition.x,weaponPosition.y,weaponPosition.z).setRotation(gripRotation).setCcdEnabled(true));
    world.createCollider(R.ColliderDesc.cuboid(.04,.075,.17).setMass(1.05).setFriction(.6),this.weapon);
    this.weaponJoint=world.createImpulseJoint(R.JointData.fixed(handAnchor,gripRotation,weaponAnchor,new Quaternion()),hand.body,this.weapon,true);
    this.weaponJoint.setContactsEnabled(false);
    const h=head.body.translation();
    this.hat=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(h.x,h.y+.14,h.z));
    world.createCollider(R.ColliderDesc.cuboid(.18,.035,.18).setMass(.25).setFriction(.7),this.hat);
    this.hatJoint=world.createImpulseJoint(R.JointData.fixed({x:0,y:.14,z:0},new Quaternion(),{x:0,y:0,z:0},new Quaternion()),head.body,this.hat,true);
    this.hatJoint.setContactsEnabled(false);
    this.props=[
      {name:'Revolver',body:this.weapon,size:[.08,.15,.34],mass:1.05,previous:new Vector3().copy(this.weapon.translation()),previousQ:new Quaternion().copy(this.weapon.rotation()),functionality:1},
      {name:'Hat',body:this.hat,size:[.36,.07,.36],mass:.25,previous:new Vector3().copy(this.hat.translation()),previousQ:new Quaternion(),functionality:1},
    ];
    if(holstered&&pelvis){
      this.world.removeImpulseJoint(this.weaponJoint,true);this.weaponJoint=null;
      const p=pelvis.body.translation();
      this.holster=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x+.31,p.y-.13,p.z+.015));
      // Four thin walls and a bottom: an open physical pocket mounted to the belt.
      for(const [x,y,z,w,h,d] of [[-.047,0,0,.008,.28,.085],[.047,0,0,.008,.28,.085],[0,0,-.045,.09,.28,.008],[0,0,.045,.09,.28,.008],[0,-.145,0,.09,.01,.09]])
        world.createCollider(R.ColliderDesc.cuboid(w/2,h/2,d/2).setTranslation(x,y,z).setMass(.044).setCollisionGroups((16<<16)|2),this.holster);
      this.holsterMount=world.createImpulseJoint(R.JointData.fixed({x:.31,y:-.13,z:.015},new Quaternion(),{x:0,y:0,z:0},new Quaternion()),pelvis.body,this.holster,true);this.holsterMount.setContactsEnabled(false);
      const hp=this.holster.translation(),q=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2);
      // Initial conditions only; no live body is teleported during the draw.
      this.weapon.setTranslation({x:hp.x,y:hp.y+.045,z:hp.z},true);this.weapon.setRotation(q,true);
      this.holsterJoint=world.createImpulseJoint(R.JointData.fixed({x:0,y:.045,z:0},q,{x:0,y:0,z:0},new Quaternion()),this.holster,this.weapon,true);this.holsterJoint.setContactsEnabled(false);
      this.props[0].previous.copy(this.weapon.translation());this.props[0].previousQ.copy(q);
      this.props.push({name:'Holster',body:this.holster,size:[.10,.30,.10],mass:.22,previous:new Vector3().copy(hp),previousQ:new Quaternion(),functionality:1});
    }
  }
  get held(){return this.weaponJoint!==null}
  get secured(){return this.held||this.holsterJoint!==null}
  get holstered(){return this.holsterJoint!==null}
  get gripPoint(){return new Vector3(0,0,-.09).applyQuaternion(new Quaternion().copy(this.weapon.rotation())).add(this.weapon.translation())}
  grasp(){
    if(!this.holstered||this.gripStrength<.22)return false;
    const handQ=new Quaternion().copy(this.hand.body.rotation());
    const actual=new Vector3(0,-.025,.04).applyQuaternion(handQ).add(this.hand.body.translation());
    if(actual.distanceTo(this.gripPoint)>.025)return false;
    const anchor=this.gripPoint.clone().sub(this.hand.body.translation()).applyQuaternion(handQ.clone().invert());
    const relative=handQ.clone().invert().multiply(new Quaternion().copy(this.weapon.rotation()));this.handFrame.copy(relative);
    this.world.removeImpulseJoint(this.holsterJoint!,true);this.holsterJoint=null;
    this.weaponJoint=this.world.createImpulseJoint(R.JointData.fixed(anchor,relative,{x:0,y:0,z:-.09},new Quaternion()),this.hand.body,this.weapon,true);this.weaponJoint.setContactsEnabled(false);return true;
  }
  dropWeapon(reason='hand capacity'){if(this.secured){this.releaseReason=reason;if(this.weaponJoint)this.world.removeImpulseJoint(this.weaponJoint,true);if(this.holsterJoint)this.world.removeImpulseJoint(this.holsterJoint,true);this.weaponJoint=null;this.holsterJoint=null}}
  dropHat(){if(this.hatJoint){this.world.removeImpulseJoint(this.hatJoint,true);this.hatJoint=null}}
  impact(impulse:Vector3,point:Vector3,dt:number,source='projectile'){
    const lever=point.clone().sub(this.weapon.translation());
    const force=impulse.length()/dt;
    const torque=lever.cross(impulse).length()/dt;
    this.peakLoad.force=Math.max(this.peakLoad.force,force);this.peakLoad.torque=Math.max(this.peakLoad.torque,torque);
    if(force>this.maxForce*this.gripStrength||torque>this.maxTorque*this.gripStrength)this.dropWeapon(source);
  }
  update(consciousness:number){
    this.gripStrength=this.hand.functionality*consciousness;
    if(this.held&&this.gripStrength<.22)this.dropWeapon(consciousness<.1?'consciousness':'injured hand');
    if(this.held){
      const collider=this.weapon.collider(0);
      this.world.contactPairsWith(collider,other=>this.world.contactPair(collider,other,(manifold,flipped)=>{
        const normal=new Vector3().copy(manifold.normal());
        for(let i=0;i<manifold.numContacts();i++){
          const point=flipped?manifold.localContactPoint2(i):manifold.localContactPoint1(i);
          if(!point)continue;
          const impulse=normal.clone().multiplyScalar(manifold.contactImpulse(i));
          const worldPoint=new Vector3().copy(point).applyQuaternion(new Quaternion().copy(this.weapon.rotation())).add(this.weapon.translation());
          this.impact(impulse,worldPoint,PHYSICS_DT,'contact: '+this.contactName(other));
        }
      }));
    }
    if(consciousness<.1)this.dropHat();
  }
}
