import type {PenetrationPolicy} from './WeaponProfiles';
import {Vector3} from 'three';
import type {CollisionEntry,HitZone} from '../physics/CollisionRegistry';
export interface RayInterval {entry:CollisionEntry;zone:HitZone;start:number;end:number;normal:Vector3;core?:[number,number]}
export interface HitEvent {
  shotId:number;
  colliderId:string;
  zone:HitZone;
  entry:CollisionEntry;
  entryPoint:Vector3;
  exitPoint?:Vector3;
  stopPoint?:Vector3;
  impactNormal:Vector3;
  enteredEnergy:number;
  remainingEnergy:number;
  depositedEnergy:number;
  penetrated:boolean;
  impulse:Vector3;
}
interface Layer {owner:HitEvent;resistance:number}
interface Boundary {t:number;start:boolean;base:boolean;interval:RayInterval;layer:Layer}
export class PenetrationSolver {
  solve(id:number,origin:Vector3,direction:Vector3,initialEnergy:number,intervals:RayInterval[],policy:PenetrationPolicy='material'):HitEvent[]{
    // Weapon policy changes the MATERIAL calculation, never just the exit graphic.
    if(policy==='stop')intervals=intervals.map(i=>(i.entry.part||i.entry.actor==='player')?{...i,entry:{...i.entry,resistance:Math.max(i.entry.resistance,initialEnergy*2/Math.max(.001,i.end-i.start))}}:i);
    if(policy==='through'){
      const body=intervals.filter(i=>i.entry.part||i.entry.actor==='player'),surface=body.reduce((s,i)=>s+i.entry.surfaceLoss,0);
      const cost=body.reduce((s,i)=>s+i.entry.resistance*(i.end-i.start)+(i.core?i.entry.coreResistance*Math.max(0,i.core[1]-i.core[0]):0),0);
      const scale=Math.max(.01,Math.min(initialEnergy>10000?1000:1,(initialEnergy*.65-surface)/Math.max(1,cost)));
      intervals=intervals.map(i=>(i.entry.part||i.entry.actor==='player')?{...i,entry:{...i.entry,resistance:i.entry.resistance*scale,coreResistance:i.entry.coreResistance*scale}}:i);
    }
    const hits:HitEvent[]=[],boundaries:Boundary[]=[],active=new Set<Layer>();
    for(const interval of intervals){
      const hit:HitEvent={shotId:id,colliderId:interval.entry.id,zone:interval.zone,entry:interval.entry,
        entryPoint:origin.clone().addScaledVector(direction,interval.start),impactNormal:interval.normal,
        enteredEnergy:0,remainingEnergy:0,depositedEnergy:0,penetrated:false,impulse:new Vector3()};
      const base:Layer={owner:hit,resistance:interval.entry.resistance};
      boundaries.push({t:interval.start,start:true,base:true,interval,layer:base},{t:interval.end,start:false,base:true,interval,layer:base});
      if(interval.core && interval.entry.coreResistance>0){
        const layer:Layer={owner:hit,resistance:interval.entry.coreResistance};
        boundaries.push({t:interval.core[0],start:true,base:false,interval,layer},{t:interval.core[1],start:false,base:false,interval,layer});
      }
    }
    boundaries.sort((a,b)=>a.t-b.t || Number(a.start)-Number(b.start));
    let energy=initialEnergy,previous=boundaries[0]?.t??0;
    const spend=(amount:number)=>{
      const resistance=[...active].reduce((sum,l)=>sum+l.resistance,0);
      for(const layer of active)layer.owner.depositedEnergy+=amount*layer.resistance/resistance;
      energy=Math.max(0,energy-amount);
    };
    for(const boundary of boundaries){
      const resistance=[...active].reduce((sum,l)=>sum+l.resistance,0);
      const loss=(boundary.t-previous)*resistance;
      if(loss>=energy && resistance>0){
        const distance=previous+energy/resistance;
        spend(energy);
        const stop=origin.clone().addScaledVector(direction,distance);
        for(const layer of active){layer.owner.stopPoint=stop.clone();layer.owner.remainingEnergy=0}
        break;
      }
      if(loss>0)spend(loss);
      previous=boundary.t;
      const hit=boundary.layer.owner;
      if(boundary.start){
        if(boundary.base){
          hit.enteredEnergy=energy;
          hits.push(hit);
          const surface=Math.min(energy,boundary.interval.entry.surfaceLoss);
          hit.depositedEnergy+=surface;energy-=surface;
          if(energy<=0){hit.stopPoint=hit.entryPoint.clone();break}
        }
        active.add(boundary.layer);
      }else{
        active.delete(boundary.layer);
        if(boundary.base){hit.penetrated=true;hit.remainingEnergy=energy;hit.exitPoint=origin.clone().addScaledVector(direction,boundary.t)}
      }
    }
    const total=hits.reduce((sum,h)=>sum+h.depositedEnergy,0);
    // Momentum lost by a 14 g game projectile; the total impulse cannot exceed its incoming momentum.
    const momentum=Math.sqrt(2*.014*initialEnergy)-Math.sqrt(2*.014*Math.max(0,initialEnergy-total));
    for(const hit of hits)hit.impulse.copy(direction).multiplyScalar(total>0?momentum*hit.depositedEnergy/total:0);
    return hits;
  }
}
