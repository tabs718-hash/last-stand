import {Bone,Matrix4,Object3D,Quaternion,Vector3} from 'three';
import type {Rig} from '../character/Rig';
import type {Part} from '../character/CharacterTypes';
/** Physical world pose → exported bone world pose, preserving each bone's bind offset.
 * No animation mixer, root teleport, or writes to the simulation. */
export class PhysicalSkeletonAdapter {
 private bindings:{bone:Bone;part:Part;offset:Matrix4}[]=[];
 private position=new Vector3();private rotation=new Quaternion();private currentRotation=new Quaternion();private unit=new Vector3(1,1,1);
 private physical=new Matrix4();private target=new Matrix4();private local=new Matrix4();
 constructor(root:Object3D,rig:Rig){
  root.updateMatrixWorld(true);
  for(const part of rig.parts){
   const bone=root.getObjectByName(part.name.replaceAll(' ','_'));
   const bind=rig.bindPose.get(part.name);
   if(!(bone instanceof Bone)||!bind)throw Error('Missing physical bone: '+part.name);
   this.bindings.push({bone,part,offset:bind.clone().invert().multiply(bone.matrixWorld)});
  }
  // A parent must be updated before computing its child's local transform.
  const depth=(o:Object3D):number=>o.parent?1+depth(o.parent):0;
  this.bindings.sort((a,b)=>depth(a.bone)-depth(b.bone));
 }
 updateFromPose(pose:Record<string,{position:Vector3;rotation:Quaternion}>){
  for(const {bone,part,offset} of this.bindings){
   const p=pose[part.name];if(!p)continue;
   this.physical.compose(p.position,p.rotation,this.unit);this.target.multiplyMatrices(this.physical,offset);
   this.local.copy(bone.parent?bone.parent.matrixWorld:new Matrix4()).invert().multiply(this.target);
   this.local.decompose(bone.position,bone.quaternion,bone.scale);bone.updateWorldMatrix(false,false);
  }
 }
 update(alpha:number){
  for(const {bone,part,offset} of this.bindings){
   this.position.lerpVectors(part.previous,part.body.translation(),alpha);
   this.rotation.slerpQuaternions(part.previousQ,this.currentRotation.copy(part.body.rotation()),alpha);
   this.physical.compose(this.position,this.rotation,this.unit);
   this.target.multiplyMatrices(this.physical,offset);
   this.local.copy(bone.parent?bone.parent.matrixWorld:new Matrix4()).invert().multiply(this.target);
   this.local.decompose(bone.position,bone.quaternion,bone.scale);
   bone.updateWorldMatrix(false,false);
  }
 }
}
