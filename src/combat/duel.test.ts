import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {GameEngine} from '../core/GameEngine';
import {DuelRules} from './DuelRules';
import {DT} from '../character/Rig';
await R.init();
const report=(test:string,measurements:unknown={})=>console.log(JSON.stringify({test,passed:true,measurements}));
const rules=new DuelRules(1);rules.start();assert.ok(rules.signalAt>=5&&rules.signalAt<=10);assert.equal(rules.trigger(),'ignored');
while(rules.phase==='waiting')rules.update(DT);
assert.equal(rules.trigger(),'draw');assert.equal(rules.playerAmmo,6);assert.equal(rules.trigger(),'drawing');
for(let i=0;i<92;i++)rules.update(DT);
assert.equal(rules.trigger(),'shot');assert.equal(rules.playerAmmo,5);assert.equal(rules.trigger(),'cooldown');
for(let i=0;i<97;i++)rules.update(DT);assert.equal(rules.trigger(),'shot');report('signal, draw delay, ammo and cooldown',{wait:rules.signalAt});
const idle=new GameEngine();try{for(let i=0;i<400;i++)idle.step();assert.equal(idle.ai.shots,0);assert.equal(idle.rules.phase,'idle')}finally{idle.dispose()}
const losing=new GameEngine();try{
 losing.start(true);let first=Infinity;
 for(let i=0;i<720;i++){losing.step();if(losing.ai.shots>0){first=losing.rules.sinceSignal;break}}
 assert.ok(Math.abs(first-3)<=DT*2,'first AI shot at 3 seconds after completing draw');assert.equal(losing.rules.phase,'signal');assert.equal(losing.playerHealth,1);assert.equal(losing.ai.ammo,5);for(let i=0;i<720&&!losing.rules.terminal;i++)losing.step();assert.equal(losing.rules.phase,'lost');assert.equal(losing.playerHealth,0);
 report('AI first shot and player defeat',{firstShot:first});
}finally{losing.dispose()}
const intervals=new GameEngine();try{
 for(const c of intervals.playerBody.hitboxes){intervals.rig.registry.entries.delete(c.handle);intervals.rig.world.removeCollider(c,true)}intervals.rig.registry.entries.delete(intervals.playerEquipment!.gun.collider(0).handle);
 intervals.start(true);const shotTimes:number[]=[];let previous=0;
 for(let i=0;i<900;i++){intervals.step();if(intervals.ai.shots!==previous){previous=intervals.ai.shots;shotTimes.push(intervals.rules.sinceSignal)}}
 assert.ok(shotTimes.length>=3);
 for(let i=1;i<shotTimes.length;i++)assert.ok(Math.abs(shotTimes[i]-shotTimes[i-1]-1.3)<DT*3);
 report('AI repeat cadence',{shotTimes});
}finally{intervals.dispose()}
const winning=new GameEngine();try{
 winning.start(true);for(let i=0;i<120;i++)winning.step();
 const camera=new Vector3(0,1.65,12),muzzle=new Vector3(.19,1.49,11.35);
 winning.trigger(camera,winning.rig.part('Head').previous.clone().sub(camera).normalize(),muzzle);winning.step();assert.equal(winning.rules.playerAmmo,6);
 for(let i=0;i<96;i++)winning.step();
 const head=new Vector3().copy(winning.rig.part('Head').body.translation());
 winning.trigger(camera,head.sub(camera).normalize(),muzzle);winning.step();
 assert.equal(winning.rules.playerAmmo,5);assert.equal(winning.rules.phase,'won');assert.equal(winning.rig.injuries.consciousness,0);assert.equal(winning.ai.shots,0);
 report('player FPS shot and victory');
}finally{winning.dispose()}
const fallen=new GameEngine();try{fallen.start(true);for(let i=0;i<120;i++)fallen.step();fallen.rig.testShot('knee','HIGH');for(let i=0;i<120;i++)fallen.step();assert.equal(fallen.rules.phase,'signal');assert.equal(fallen.rig.injuries.consciousness,1);assert.ok(fallen.rig.injuries.alive);report('leg wound is not automatic victory')}finally{fallen.dispose()}
