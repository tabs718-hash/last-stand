import type R from '@dimforge/rapier3d-compat';

export type JointRanges = readonly [readonly [number,number],readonly [number,number],readonly [number,number]];
export function anatomicalRanges(name:string):JointRanges {
  if(name==='Head')return [[-.65,.65],[-1.0,1.0],[-.5,.5]];
  if(/thigh/.test(name))return [[-1.6,.65],[-.6,.6],[-.7,.7]];
  if(/foot/.test(name))return [[-.55,.55],[-.25,.25],[-.3,.3]];
  if(/upper arm/.test(name))return [[-2.5,1.3],[-1.4,1.4],[-2.0,2.0]];
  if(/hand/.test(name))return [[-.8,.8],[-.5,.5],[-.5,.5]];
  return [[-.4,.4],[-.35,.35],[-.35,.35]];
}

// Rapier 0.19 exposes multi-axis limits on its public raw joint set, but not
// on SphericalImpulseJoint. Keep this version-specific adapter isolated.
export function setSphericalLimits(world:R.World,joint:R.ImpulseJoint,ranges:JointRanges){
  world.impulseJoints.raw.jointSetLimits(joint.handle,3,...ranges[0]); // AngX
  world.impulseJoints.raw.jointSetLimits(joint.handle,4,...ranges[1]); // AngY
  world.impulseJoints.raw.jointSetLimits(joint.handle,5,...ranges[2]); // AngZ
}
