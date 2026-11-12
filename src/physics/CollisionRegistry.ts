import type R from '@dimforge/rapier3d-compat';
import type {Part} from '../character/CharacterTypes';
export type HitZone='head'|'chest'|'abdomen'|'pelvis'|'upperArm'|'forearm'|'hand'|'thigh'|'knee'|'shin'|'foot'|'weapon'|'hat'|'environment';
export interface CollisionEntry {
  id:string;
  actor?:'player'|'opponent';
  collider:R.Collider;
  body?:R.RigidBody;
  part?:Part;
  zone:HitZone;
  size:[number,number,number];
  resistance:number;
  surfaceLoss:number;
  coreResistance:number;
}
export class CollisionRegistry {
  entries=new Map<number,CollisionEntry>();
  add(entry:CollisionEntry){this.entries.set(entry.collider.handle,entry);return entry}
  get(handle:number){return this.entries.get(handle)}
}
export function bodyZone(name:string):HitZone {
  if(name==='Head')return 'head';if(name==='Chest')return 'chest';if(name==='Abdomen')return 'abdomen';if(name==='Pelvis')return 'pelvis';
  if(name.includes('upper arm'))return 'upperArm';if(name.includes('forearm'))return 'forearm';if(name.includes('hand'))return 'hand';if(name.includes('thigh'))return 'thigh';if(name.includes('shin'))return 'shin';return 'foot';
}
