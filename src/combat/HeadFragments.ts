import R from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import type {Part} from '../character/CharacterTypes';
/** Bounded fictional fracture pool. Each visible piece is a real gravity/contact body. */
export class HeadFragments {
 pieces:{body:R.RigidBody;size:number;index:number}[]=[];destroyed=false;
 constructor(private world:R.World){}
 burst(head:Part,direction:Vector3){
  if(this.destroyed)return;this.destroyed=true;
  const center=new Vector3().copy(head.body.translation()),velocity=new Vector3().copy(head.body.linvel());
  for(let i=0;i<18;i++){
   const a=i*2.399963,b=(i+.5)/18,y=1-2*b,r=Math.sqrt(1-y*y),radial=new Vector3(Math.cos(a)*r,y,Math.sin(a)*r),size=.026+(i%4)*.004;
   const p=center.clone().addScaledVector(radial,.065),v=velocity.clone().addScaledVector(direction,2.2).addScaledVector(radial,1.8+(i%3)*.6);v.y+=1;
   const body=this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setLinvel(v.x,v.y,v.z).setAngvel({x:radial.z*12,y:radial.x*10,z:radial.y*12}).setLinearDamping(.15).setAngularDamping(.3).setCcdEnabled(true));
   this.world.createCollider(R.ColliderDesc.ball(size).setMass(head.mass/18).setRestitution(.18).setFriction(.8).setCollisionGroups((512<<16)|2),body);this.pieces.push({body,size,index:i});
  }
 }
}
