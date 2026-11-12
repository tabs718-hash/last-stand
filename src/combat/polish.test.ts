import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion} from 'three';
import {AimInput} from '../input/AimInput';
import {MUZZLE_LOCAL,recoilAt,weaponPose} from '../input/WeaponPresentation';
import {GameEngine} from '../core/GameEngine';
import {DT} from '../character/Rig';
import {DuelRules} from './DuelRules';
const report=(test:string)=>console.log(JSON.stringify({test,passed:true}));
// Ballistic and visual muzzle agree at arbitrary input, draw, ADS and recoil states.
const aim=new AimInput();aim.moveRelative(130,-45);aim.zoom=true;for(let i=0;i<24;i++)aim.advance(1/60);
assert.ok(aim.ads>.99);
for(const draw of [0,.2,.7,1])for(const age of [0,.025,.08,.22,.4]){
 const pose=aim.snapshot(recoilAt(age),draw);
 const actual=MUZZLE_LOCAL.clone().applyQuaternion(pose.weapon.rotation).add(pose.weapon.position);
 assert.ok(actual.distanceTo(pose.muzzle)<1e-10);assert.ok(pose.muzzle.toArray().every(Number.isFinite));
}
const eye=new Vector3(0,1.65,12),rotation=new Quaternion();
const hip=weaponPose(eye,rotation,1,0,0),ads=weaponPose(eye,rotation,1,1,0);
assert.ok(Math.abs(ads.muzzle.x)<1e-8);assert.ok(Math.abs(ads.muzzle.x)<Math.abs(hip.muzzle.x));
assert.ok(recoilAt(.025)>recoilAt(.12));assert.equal(recoilAt(.4),0);assert.equal(recoilAt(-1),0);
const held=aim.snapshot(.2,1);assert.deepEqual(aim.snapshot(.2,1).muzzle.toArray(),held.muzzle.toArray());
report('shared visual/muzzle pose, ADS alignment and simulation-time recoil');
const rules=new DuelRules(7);rules.start(true);rules.update(DT);assert.equal(rules.triggerState,'holstered');assert.equal(rules.trigger(),'draw');
rules.update(.75);assert.equal(rules.triggerState,'drawing');assert.equal(rules.trigger(),'drawing');assert.equal(rules.playerAmmo,6);
rules.update(.02);for(let i=0;i<6;i++){assert.equal(rules.trigger(),'shot');if(i<5){assert.equal(rules.trigger(),'cooldown');assert.ok(rules.cooldownProgress<.001);rules.update(.801)}}
assert.equal(rules.triggerState,'empty');assert.equal(rules.trigger(),'empty');assert.equal(rules.playerAmmo,0);
report('draw lock, cooldown feedback and empty cylinder without phantom shots');
await R.init();
const early=new GameEngine();try{
 early.start();early.step();const phases:string[]=[],actions:string[]=[];
 early.events.on('phaseChanged',e=>phases.push(e.to));early.events.on('playerAction',e=>actions.push(e.action));
 const p=new AimInput().snapshot();assert.equal(early.trigger(p.camera,p.direction,p.muzzle),true);early.step();
 assert.deepEqual(actions,['wait']);assert.equal(early.rules.playerDrawAt,Infinity);assert.equal(early.rules.playerAmmo,6);assert.equal(early.rig.ballistics.sequence,0);
 early.rules.signalAt=early.rules.elapsed;early.step();early.trigger(p.camera,p.direction,p.muzzle);early.step();
 for(let i=0;i<100;i++)early.step();early.trigger(p.camera,p.direction,p.muzzle);early.setInputEnabled(false);early.step();assert.equal(early.rules.playerAmmo,6);
 assert.deepEqual(phases,['signal']);report('early click warning, one signal, paused trigger cancellation');
}finally{early.dispose()}
const exhausted=new GameEngine();try{
 for(const c of exhausted.playerBody.hitboxes){exhausted.rig.registry.entries.delete(c.handle);exhausted.rig.world.removeCollider(c,true)}exhausted.rig.registry.entries.delete(exhausted.playerEquipment!.gun.collider(0).handle);
 exhausted.start(true);exhausted.step();
 const snapshot=new AimInput();snapshot.pitch=.5;const p=snapshot.snapshot();
 exhausted.trigger(p.camera,p.direction,p.muzzle);exhausted.step();for(let i=0;i<100;i++)exhausted.step();
 for(let round=0;round<6;round++){
  exhausted.trigger(p.camera,p.direction,p.muzzle);exhausted.step();for(let i=0;i<100;i++)exhausted.step();
 }
 assert.equal(exhausted.rules.playerAmmo,0);assert.equal(exhausted.rules.phase,'signal','one empty cylinder does not end the duel');
 for(let i=0;i<960&&!exhausted.rules.terminal;i++)exhausted.step();
 assert.ok(exhausted.ai.shots>6);assert.equal(exhausted.rules.phase,'signal');assert.ok(exhausted.reload());for(let i=0;i<265;i++)exhausted.step();assert.equal(exhausted.rules.playerAmmo,6);assert.equal(exhausted.rules.phase,'signal');
 report('empty cylinders keep combat active and permit reload');
}finally{exhausted.dispose()}
const reset=new GameEngine();try{assert.equal(reset.rules.phase,'idle');assert.equal(reset.rules.playerAmmo,6);assert.equal(reset.ai.ammo,6);assert.equal(reset.playerHits,0);assert.equal(reset.resultAt,0);report('fresh duel clears result, ammunition, stats and pending inputs')}finally{reset.dispose()}

const proxies=new GameEngine();try{
 for(const p of proxies.rig.parts){assert.ok(Math.abs(p.body.mass()-p.mass)<1e-5,'query proxies add no mass');const entry=[...proxies.rig.registry.entries.values()].find(e=>e.part===p)!;assert.ok(entry.collider.isSensor());assert.notEqual(entry.collider.handle,p.body.collider(0).handle)}
 proxies.rig.step();
 const shot=proxies.rig.ballistics.shoot(new Vector3(.205,1.37,3),new Vector3(0,0,-1),60,proxies.rig.time);assert.equal(shot.hits[0]?.zone,'chest','wider clothed silhouette is hittable');
 report('clothed hit volumes widen targeting without mass or mechanical collision changes');
}finally{proxies.dispose()}
