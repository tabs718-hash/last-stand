export const FIXED_DT = 1 / 120;
export const PHYSICS_SUBSTEPS = 4;
export const PHYSICS_DT = FIXED_DT / PHYSICS_SUBSTEPS;
export const GRAVITY = 9.81;
export const SEED = 1;

export interface MuscleProfile {
  stiffness: number;
  damping: number;
  maxTorque: number;
  activation: number;
  injuryMultiplier: number;
  targetResponseSpeed: number;
}

export function muscleProfile(name: string, minimumInertia: number, maxTorque: number): MuscleProfile {
  const leg = /thigh|shin|foot/.test(name);
  const stiffness = leg ? 1800 : /Abdomen|Chest/.test(name) ? 900 : name === 'Head' ? 80 : name.includes('upper arm')?80:name.includes('forearm')?45:30;
  return {
    stiffness,
    damping: Math.max(1.4 * Math.sqrt(stiffness * minimumInertia),name.includes('upper arm')?3:name.includes('forearm')?1.5:name.includes('hand')?.35:0),
    maxTorque,
    activation: 1,
    injuryMultiplier: 1,
    targetResponseSpeed: /upper arm|forearm|hand/.test(name)?6:10,
  };
}
