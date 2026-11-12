import type R from '@dimforge/rapier3d-compat';
import {Quaternion, Vector3} from 'three';
import type {MuscleProfile} from '../config/ragdoll';

export interface Part {
  name: string;
  destroyed?:boolean;
  body: R.RigidBody;
  size: [number, number, number];
  mass: number;
  previous: Vector3;
  previousQ: Quaternion;
  functionality: number;
}

export interface Muscle {
  a: Part;
  b: Part;
  joint: R.ImpulseJoint;
  hinge: boolean;
  stateActivation: number;
  targetRate: number;
  profile: MuscleProfile;
  target: Quaternion;
  desired: Quaternion;
  torque: Vector3;
  balanceTorque: Vector3;
  angleError: number;
  limit: number;
}
