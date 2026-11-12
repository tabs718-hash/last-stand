import {Quaternion,Vector3} from 'three';
import type {Muscle,Part} from './CharacterTypes';
export interface SegmentPose {position:Vector3;rotation:Quaternion}
/** Forward kinematics for diagnostic rendering only. Never writes to a rigid body. */
export function targetPoses(root:Part,muscles:Muscle[],rootPose?:SegmentPose):Map<string,SegmentPose>{
  const poses=new Map<string,SegmentPose>();
  poses.set(root.name,rootPose??{position:new Vector3().copy(root.body.translation()),rotation:new Quaternion().copy(root.body.rotation())});
  for(const muscle of muscles){
    const parent=poses.get(muscle.a.name);
    if(!parent)throw Error('Target pose parent missing: '+muscle.a.name);
    const rotation=parent.rotation.clone().multiply(muscle.target);
    const anchor=new Vector3().copy(muscle.joint.anchor1()).applyQuaternion(parent.rotation).add(parent.position);
    const position=anchor.sub(new Vector3().copy(muscle.joint.anchor2()).applyQuaternion(rotation));
    poses.set(muscle.b.name,{position,rotation});
  }
  return poses;
}
