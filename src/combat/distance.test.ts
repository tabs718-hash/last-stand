import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {GameEngine} from '../core/GameEngine';
import {DUEL_DISTANCES} from '../config/duel';
await R.init();
const defaults=new GameEngine();assert.equal(defaults.duelDistance,12);defaults.dispose();
assert.throws(()=>new GameEngine(1,'standing','duel',4),RangeError);
for(const distance of DUEL_DISTANCES){
 const e=new GameEngine(1,'standing','duel',distance);try{
 assert.equal(e.playerBody.body.translation().z,distance);assert.ok(Math.abs(e.playerEquipment!.hand.translation().z-(distance-.1))<1e-5);assert.equal(e.playerEquipment!.cameraPosition.z,distance);
 e.start(true);for(let i=0;i<425&&!e.ai.shots;i++)e.step();
 assert.equal(e.ai.shots,1,'AI must aim at selected distance '+distance);assert.equal(e.rules.phase,'signal');assert.ok(e.playerHealth>0,'first hit is nonlethal at '+distance);assert.ok(e.rig.ballistics.lastShot!.hits.some(h=>h.entry.actor==='player'));for(let i=0;i<600&&!e.rules.terminal;i++)e.step();assert.equal(e.rules.phase,'lost');assert.equal(e.playerBody.vitals.torsoHits,2);
 }finally{e.dispose()}
 const p=new GameEngine(1,'standing','duel',distance);try{
 p.start(true);p.step();let camera=p.playerBody.eye();p.trigger(camera,new Vector3(0,0,-1),p.playerEquipment!.muzzle());p.step();
 for(let i=0;i<120;i++)p.step();assert.ok(p.playerEquipment!.ready,'physical draw must complete at '+distance);
 camera=p.playerBody.eye();const target=new Vector3().copy(p.rig.part('Head').body.translation());p.trigger(camera,target.sub(camera).normalize(),p.playerEquipment!.muzzle());p.step();assert.equal(p.rules.phase,'won','player hits head at '+distance);assert.equal(p.rules.playerShots,1);
 console.log(JSON.stringify({test:'selected distance: spawn, holster, physical draw, both firing directions and death-only result',distance,passed:true}));
 }finally{p.dispose()}
}
