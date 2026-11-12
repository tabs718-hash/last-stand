import {Quaternion,Vector3} from 'three';
import type {Muscle} from './CharacterTypes';
export interface LegTargets {hip:Quaternion;knee:Quaternion;ankle:Quaternion;reachable:boolean}
/** Joint-space targets for a two-link leg. The solver never moves rigid bodies. */
export function solveLegTargets(hip:Muscle,knee:Muscle,ankle:Muscle,footPosition:Vector3,footRotation:Quaternion,rootPose?:{position:Vector3;rotation:Quaternion}):LegTargets {
  const parentRotation=rootPose?.rotation.clone()??new Quaternion().copy(hip.a.body.rotation());
  const origin=new Vector3().copy(hip.joint.anchor1()).applyQuaternion(parentRotation).add(rootPose?.position??hip.a.body.translation());
  const goal=footPosition.clone().add(new Vector3().copy(ankle.joint.anchor2()).applyQuaternion(footRotation));
  const local=goal.sub(origin).applyQuaternion(parentRotation.clone().invert());
  const l1=new Vector3().copy(knee.joint.anchor1()).distanceTo(new Vector3().copy(hip.joint.anchor2()));
  const l2=new Vector3().copy(ankle.joint.anchor1()).distanceTo(new Vector3().copy(knee.joint.anchor2()));
  const rawDistance=local.length(),distance=Math.max(.12,Math.min(l1+l2-.0005,rawDistance));
  const roll=Math.atan2(local.x,-local.y);
  const flex=Math.acos(Math.max(-1,Math.min(1,(distance*distance-l1*l1-l2*l2)/(2*l1*l2))));
  const pitch=Math.atan2(-local.z,Math.hypot(local.x,local.y))-Math.atan2(l2*Math.sin(flex),l1+l2*Math.cos(flex));
  const hipTarget=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.max(-.65,Math.min(.65,roll)))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.max(-1.6,Math.min(.65,pitch))));
  const kneeTarget=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.min(2.35,flex));
  const shinWorld=parentRotation.multiply(hipTarget).multiply(kneeTarget);
  const ankleTarget=shinWorld.invert().multiply(footRotation);
  return {hip:hipTarget,knee:kneeTarget,ankle:ankleTarget,reachable:rawDistance<=l1+l2&&Math.abs(roll)<.65};
}
