import {VERSION} from '../config/version';
import type {GameEngine} from './GameEngine';
import {FIXED_DT,PHYSICS_SUBSTEPS} from '../config/ragdoll';
export function downloadScenario(engine:GameEngine){
 const rig=engine.rig;
 const record={schema:3,build:VERSION,rapierVersion:engine.physicsVersion,seed:engine.seed,duelDistance:engine.duelDistance,initialPose:engine.initialPose,recoveryStepEnabled:rig.recoveryStep.enabled,fixedDt:FIXED_DT,physicsSubsteps:PHYSICS_SUBSTEPS,
  initialBodies:rig.initialBodies,hitboxes:[...rig.registry.entries.values()].filter(e=>e.part).map(e=>({name:e.id,size:e.size,sensor:e.collider.isSensor()})),muscles:rig.muscles.map(m=>({parent:m.a.name,child:m.b.name,profile:m.profile})),
  commands:rig.commandLog,duelCommands:engine.commandLog,shots:rig.ballistics.history.map(s=>({id:s.id,time:s.time,origin:s.origin.toArray(),direction:s.direction.toArray(),energy:s.initialEnergy,penetrationPolicy:s.penetrationPolicy,bodyPose:s.bodyPose,hits:s.hits.map(h=>({collider:h.colliderId,zone:h.zone,entry:h.entryPoint.toArray(),exit:h.exitPoint?.toArray(),stop:h.stopPoint?.toArray(),deposited:h.depositedEnergy,remaining:h.remainingEnergy}))})),
  snapshot:{fracture:{headDestroyed:rig.fragments.destroyed,pieces:rig.fragments.pieces.map(p=>({index:p.index,position:p.body.translation(),velocity:p.body.linvel()}))},legReaction:{age:rig.injuries.collapseAge,injured:[...rig.injuries.injuredLegs]},time:rig.time,step:rig.steps,phase:engine.rules.phase,ammo:engine.rules.playerAmmo,aiAmmo:engine.ai.ammo,aiShots:engine.ai.shots,playerHits:engine.playerHits,resultAt:engine.resultAt,resultVisible:engine.rules.resultVisible,draw:{phase:rig.draw.phase,progress:rig.draw.progress,holstered:rig.grip.holstered,handFrame:rig.grip.handFrame.toArray()},playerEquipment:engine.playerEquipment?{holstered:engine.playerEquipment.holstered,ready:engine.playerEquipment.ready}:null,bodies:rig.allParts.map(p=>({name:p.name,position:p.body.translation(),rotation:p.body.rotation(),linearVelocity:p.body.linvel(),angularVelocity:p.body.angvel(),functionality:p.functionality}))}};
 const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='last-draw-scenario-seed-'+engine.seed+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
