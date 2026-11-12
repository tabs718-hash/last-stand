import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {Rig,DT} from './Rig';
import {GameEngine} from '../core/GameEngine';
await R.init();
const report=(test:string,measurements:unknown={})=>console.log(JSON.stringify({test,passed:true,measurements}));
const advance=(r:Rig,seconds:number)=>{for(let i=0;i<Math.round(seconds/DT);i++){r.step();for(const p of r.allParts)assert.ok(Object.values(p.body.translation()).every(Number.isFinite));for(const m of r.muscles)assert.ok(m.torque.length()<=m.limit+1e-6,'finite muscle torque budget')}};
const leftShare=(r:Rig)=>{
 let left=0,total=0;for(let i=0;i<120;i++){r.step();for(const f of r.balance.support.feet){total+=f.load;if(f.part.name.startsWith('Left'))left+=f.load}}
 return left/total;
};
const load=new Rig();try{
 advance(load,3);const before=leftShare(load);load.testShot('knee','LOW');advance(load,5);const after=leftShare(load);
 assert.ok(load.part('Pelvis').body.translation().y<.5);assert.ok(load.injuries.alive);assert.equal(load.part('Left shin').functionality,1);assert.ok(load.part('Right shin').functionality<.8);
 report('local knee wound causes a nonlethal physical fall',{leftShareBefore:before,leftShareAfter:after});
}finally{load.dispose()}
const recovery=new Rig();try{
 advance(recovery,3);
 // Production controllers must not write transforms to obtain a step or a recovery.
 for(const p of recovery.allParts){p.body.setTranslation=()=>{throw Error('Dynamic transform write')};p.body.setRotation=()=>{throw Error('Dynamic transform write')}}
 const handBefore=new Vector3().copy(recovery.part('Left hand').body.translation()).sub(recovery.part('Chest').body.translation());
 recovery.impulse(32);let maxBrace=0,maxCrouch=0,maxHandMotion=0;
 for(let i=0;i<960;i++){recovery.step();maxBrace=Math.max(maxBrace,recovery.behaviour.brace);maxCrouch=Math.max(maxCrouch,recovery.balance.crouch);maxHandMotion=Math.max(maxHandMotion,new Vector3().copy(recovery.part('Left hand').body.translation()).sub(recovery.part('Chest').body.translation()).distanceTo(handBefore));for(const m of recovery.muscles)assert.ok(m.torque.length()<=m.limit+1e-6)}
 assert.ok(recovery.recoveryStep.completed>=1);assert.ok(recovery.recoveryStep.maxClearance>.025);assert.ok(recovery.recoveryStep.displacement>.06);assert.ok(recovery.part('Pelvis').body.translation().y>.9);
 assert.ok(recovery.balance.velocity.clone().setY(0).length()<.06);assert.equal(recovery.contacts,2);
 recovery.recoveryStep.enabled=false;advance(recovery,1);assert.ok(recovery.part('Pelvis').body.translation().y>.9);
 report('physical recovery step and stable new stance',{steps:recovery.recoveryStep.completed,clearance:recovery.recoveryStep.maxClearance,travel:recovery.recoveryStep.displacement,pelvis:recovery.part('Pelvis').body.translation().y,weaponHeld:recovery.grip.held,releaseReason:recovery.grip.releaseReason});
 assert.ok(maxBrace>.5);assert.ok(maxCrouch>.02);assert.ok(maxHandMotion>.15);assert.ok(recovery.part('Left hand').functionality===1);report('protective free arm and knee flexion',{maxBrace,maxCrouch,maxHandMotion});
}finally{recovery.dispose()}
const overload=new Rig();try{
 advance(overload,3);overload.impulse(60);advance(overload,7);assert.ok(overload.part('Pelvis').body.translation().y<.5);assert.equal(overload.injuries.consciousness,1);assert.equal(overload.behaviour.mode,'grounded');assert.ok(overload.behaviour.groundContacts.length>0);
 report('bounded recovery still permits physical overload fall',{groundContacts:overload.behaviour.groundContacts});
}finally{overload.dispose()}
const ground=new GameEngine(1,'supine');try{
 const originalHeight=ground.rig.part('Pelvis').body.translation().y;assert.ok(originalHeight<.2);
 ground.start(true);let fired=Infinity;
 for(let i=0;i<600;i++){ground.step();if(ground.ai.shots){fired=ground.rules.sinceSignal;break}}
 assert.ok(fired>=3&&fired<3.1);assert.equal(ground.rig.behaviour.mode,'grounded');assert.equal(ground.rig.grip.held,true);assert.equal(ground.rig.injuries.consciousness,1);assert.equal(ground.rules.phase,'signal');assert.equal(ground.playerHealth,1);assert.ok(ground.rig.ballistics.lastShot!.hits.some(hit=>hit.entry.actor==='player'));
 const shot=ground.rig.ballistics.lastShot!;assert.ok(shot.origin.distanceTo(new Vector3().copy(ground.rig.grip.weapon.translation()))<.3);
 report('conscious ground posture, retained grip and physical AI shot',{firstShot:fired,muzzle:shot.origin.toArray()});
 ground.rig.testShot('head','HIGH');for(let i=0;i<240;i++)ground.step();assert.equal(ground.rig.injuries.consciousness,0);assert.equal(ground.rig.behaviour.mode,'unconscious');assert.ok(ground.rig.muscles.every(m=>m.limit<.001));assert.equal(ground.rig.grip.held,false);
 report('critical ground head injury disables conscious pose control');
}finally{ground.dispose()}
const air=new Rig();try{
 advance(air,3);air.world.removeCollider(air.ground,true);
 const com=()=>{const p=new Vector3();let mass=0;for(const part of air.allParts){p.addScaledVector(new Vector3().copy(part.body.worldCom()),part.mass);mass+=part.mass}return p.divideScalar(mass)};
 const before=com();advance(air,.2);const after=com();assert.equal(air.contacts,0);assert.ok(before.y-after.y>.17&&before.y-after.y<.22);assert.ok(air.muscles.every(m=>m.balanceTorque.length()<1e-8));
 report('no aerial balance anchor',{drop:before.y-after.y});
}finally{air.dispose()}
const injured=new Rig();try{advance(injured,3);injured.testShot('knee','HIGH');advance(injured,5);assert.equal(injured.recoveryStep.attempts,0);assert.equal(injured.part('Right hand').functionality,1);assert.equal(injured.injuries.consciousness,1);assert.ok(injured.part('Pelvis').body.translation().y<.5);report('severely damaged leg cannot perform a recovery step')}finally{injured.dispose()}
const detached=new Rig();try{
 advance(detached,3);detached.grip.dropWeapon('test release');advance(detached,.4);
 const parts=[...detached.parts,...detached.grip.props.filter(p=>p.name==='Hat'&&detached.grip.hatJoint)];
 const expected=new Vector3();let mass=0;for(const p of parts){expected.addScaledVector(new Vector3().copy(p.body.worldCom()),p.mass);mass+=p.mass}expected.divideScalar(mass);
 assert.ok(expected.distanceTo(detached.com)<1e-7);report('detached props do not distort character COM');
}finally{detached.dispose()}
