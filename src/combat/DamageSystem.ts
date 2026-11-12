import type {HitEvent} from './PenetrationSolver';
import {InjuryModel} from './InjuryModel';
import {GripController} from './GripController';
import type {Part} from '../character/CharacterTypes';
import type {Vector3} from 'three';
import {isArm} from './VitalState';
import {FIXED_DT} from '../config/ragdoll';
export class DamageSystem {
  constructor(public injuries:InjuryModel,public grip:GripController,private fracture?:(head:Part,direction:Vector3)=>void){}
  resolve(hits:HitEvent[]){
    const primary=new Map<number,HitEvent>();for(const hit of hits)if(hit.entry.part&&hit.depositedEnergy>0&&!primary.has(hit.shotId))primary.set(hit.shotId,hit);
    for(const hit of hits){
      if(hit.entry.actor==='player')continue;
      if(hit.entry.body)hit.entry.body.applyImpulseAtPoint(hit.impulse,hit.entryPoint,true);
      if(hit.zone==='weapon')this.grip.impact(hit.impulse,hit.entryPoint,FIXED_DT);
      if(hit.zone==='hat'&&hit.impulse.length()>.15)this.grip.dropHat();
      this.injuries.apply(hit,primary.get(hit.shotId)===hit||hit.zone==='head');
      if(hit.zone==='head'&&hit.enteredEnergy>10000&&hit.entry.part)this.fracture?.(hit.entry.part,hit.impulse.clone().normalize());
      if(hit.depositedEnergy>0&&isArm(hit.zone)&&hit.entry.part?.name.startsWith('Right')&&this.grip.held)this.grip.dropWeapon('armed arm hit');
    }
    this.grip.update(this.injuries.consciousness);
  }
}
