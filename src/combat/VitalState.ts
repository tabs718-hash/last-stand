import type {HitZone} from '../physics/CollisionRegistry';
export const isTorso=(zone:HitZone)=>zone==='chest'||zone==='abdomen'||zone==='pelvis';
export const isArm=(zone:HitZone)=>zone==='upperArm'||zone==='forearm'||zone==='hand';
export const isLeg=(zone:HitZone)=>zone==='thigh'||zone==='knee'||zone==='shin'||zone==='foot';
/** Explicit game lethality, independent of projectile energy and motor impairment. */
export class VitalState {
 alive=true;torsoHits=0;deathReason:'head'|'torso'|null=null;
 private seen=new Set<number>();
 apply(zone:HitZone,shotId:number,energy:number){
  if(!this.alive||energy<=0)return;
  if(zone==='head'){this.alive=false;this.deathReason='head';return}
  if(this.seen.has(shotId))return;
  this.seen.add(shotId);if(this.seen.size>128)this.seen.delete(this.seen.values().next().value!);
  if(isTorso(zone)){this.torsoHits++;if(this.torsoHits>=2){this.alive=false;this.deathReason='torso'}}
 }
 get health(){return this.alive?2-this.torsoHits:0}
}
