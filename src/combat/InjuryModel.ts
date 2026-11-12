import {Vector3} from 'three';
import type {Part} from '../character/CharacterTypes';
import type {HitEvent} from './PenetrationSolver';
import {VitalState,isArm,isLeg} from './VitalState';
export interface LimbCondition {structuralIntegrity:number;motorCapacity:number;supportCapacity:number;gripCapacity:number;painResponse:number;impaired:boolean}
export class InjuryModel {
 conditions=new Map<string,LimbCondition>();vitals=new VitalState();consciousness=1;
 forcedCollapse=false;collapseAge=0;
 private reactions=new Map<string,number>();
 reactionDirections=new Map<string,Vector3>();injuredLegs=new Set<string>();
 constructor(private parts:Part[]){for(const p of parts)this.conditions.set(p.name,{structuralIntegrity:1,motorCapacity:1,supportCapacity:1,gripCapacity:1,painResponse:0,impaired:false})}
 get alive(){return this.vitals.alive}
 update(dt:number){if(this.forcedCollapse){this.collapseAge+=dt;const t=Math.max(0,Math.min(1,(this.collapseAge-.16)/.8));for(const p of this.parts)if(this.injuredLegs.has(p.name)){p.functionality=.7*(1-t)+.1*t;const c=this.conditions.get(p.name)!;c.motorCapacity=p.functionality;c.supportCapacity=p.functionality}}for(const [name,t] of this.reactions){if(t<=dt)this.reactions.delete(name);else this.reactions.set(name,t-dt)}}
 reactionActivation(name:string){return this.reactions.has(name) ? .6 : 1}
 reactionAmount(name:string){const left=this.reactions.get(name);return left===undefined?0:Math.sin(Math.PI*(1-left/.55))}
 apply(hit:HitEvent,countVital=true){
  const part=hit.entry.part;if(!part||hit.depositedEnergy<=0)return;
  if(countVital)this.vitals.apply(hit.zone,hit.shotId,hit.depositedEnergy);
  if(!this.vitals.alive)this.consciousness=0;
  const severity=Math.min(isArm(hit.zone)?.5:.45,hit.depositedEnergy/(isLeg(hit.zone)?180:hit.zone==='hand'?90:300));
  const condition=this.conditions.get(part.name)!;
  condition.structuralIntegrity=Math.max(0,condition.structuralIntegrity-severity);
  condition.motorCapacity=Math.max(.3,condition.motorCapacity*(1-severity));condition.supportCapacity=Math.max(.1,condition.supportCapacity*(1-severity));
  condition.gripCapacity=condition.motorCapacity;condition.painResponse=Math.min(1,condition.painResponse+severity);condition.impaired=condition.motorCapacity<.65;part.functionality=condition.motorCapacity;
  if(isArm(hit.zone)){
   const side=part.name.startsWith('Right')?'Right':'Left';for(const p of this.parts.filter(p=>p.name.startsWith(side)&&/upper arm|forearm|hand/.test(p.name))){this.reactions.set(p.name,.55);this.reactionDirections.set(p.name,hit.impulse.clone().normalize())}
  }
  if(isLeg(hit.zone)){
   if(!this.forcedCollapse){this.forcedCollapse=true;this.collapseAge=0}
   const side=part.name.startsWith('Right')?'Right':'Left';
   for(const p of this.parts.filter(p=>p.name.startsWith(side)&&/thigh|shin|foot/.test(p.name))){this.injuredLegs.add(p.name);p.functionality=.7;const c=this.conditions.get(p.name)!;c.motorCapacity=.7;c.supportCapacity=.7;c.impaired=true;this.reactionDirections.set(p.name,hit.impulse.clone().normalize())}
  }
 }
}
