import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Vector3,Quaternion,PerspectiveCamera,Box3} from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {VitalState} from './VitalState';
import {Rig} from '../character/Rig';
import {GameEngine} from '../core/GameEngine';
import {weaponPose} from '../input/WeaponPresentation';
import {WEAPON_PROFILES} from './WeaponProfiles';
const report=(test:string,data:unknown={})=>console.log(JSON.stringify({test,passed:true,data}));
for(const energy of [60,220,540,80000]){
 const v=new VitalState();for(const z of ['upperArm','forearm','hand','thigh','knee','shin','foot'] as const)for(let n=0;n<5;n++)v.apply(z,energy+n*1000+z.length,energy);
 assert.ok(v.alive);assert.equal(v.torsoHits,0);v.apply('chest',100001,energy);v.apply('abdomen',100001,energy);assert.equal(v.torsoHits,1);assert.ok(v.alive);v.apply('pelvis',100002,energy);assert.ok(!v.alive);
 const h=new VitalState();h.apply('head',1,energy);assert.ok(!h.alive);
}report('all profiles: head lethal, two distinct torso shots, five limb hits nonlethal, through-shot dedup');
await R.init();
let cases=0;
for(const mode of ['LOW','MEDIUM','HIGH','POWER'] as const)for(const side of ['Left','Right'])for(const name of ['thigh','shin','foot']){
 const r=new Rig();try{
 for(let i=0;i<360;i++)r.step();const point=new Vector3().copy(r.part(side+' '+name).body.translation());
 const shot=r.ballistics.shoot(point.clone().add(new Vector3(0,0,3)),new Vector3(0,0,-1),WEAPON_PROFILES[mode].energy,r.time,new Set(),WEAPON_PROFILES[mode].penetration);
 assert.ok(['thigh','knee','shin','foot'].includes(shot.hits[0]?.zone));r.damage.resolve(shot.hits);
 for(const p of r.allParts){p.body.setTranslation=()=>{throw Error('scripted fall translation')};p.body.setRotation=()=>{throw Error('scripted fall rotation')}}
 for(let i=0;i<360;i++)r.step();assert.ok(r.injuries.alive);assert.equal(r.injuries.vitals.torsoHits,0);assert.ok(r.part('Pelvis').body.translation().y<.5,mode+side+name);cases++;
 }finally{r.dispose()}
}report('every leg region, both sides, all profiles: physical nonlethal fall in 3 seconds',{cases});
for(const side of ['Left','Right']){
 const r=new Rig();try{for(let i=0;i<360;i++)r.step();const arm=r.part(side+' upper arm'),before=new Vector3().copy(arm.body.translation());
 const p=new Vector3().copy(arm.body.translation()),shot=r.ballistics.shoot(p.clone().add(new Vector3(0,0,3)),new Vector3(0,0,-1),60,r.time,new Set(),'stop');assert.equal(shot.hits[0]?.entry.part?.name,arm.name);r.damage.resolve(shot.hits);
 assert.equal(r.grip.held,side==='Left');assert.ok(arm.body.linvel().z<-.01);let travel=0;for(let i=0;i<65;i++){r.step();travel=Math.max(travel,new Vector3().copy(arm.body.translation()).distanceTo(before))}assert.ok(travel>.015);assert.ok(r.injuries.alive);report('arm impulse and armed-side guaranteed release '+side,{travel});
 }finally{r.dispose()}
}
const e=new GameEngine();try{
 e.start(true);e.step();e.rig.grip.dropWeapon('acceptance disarm');e.playerEquipment!.drop();e.rules.playerAmmo=0;e.ai.ammo=0;for(let i=0;i<400;i++)e.step();assert.equal(e.rules.phase,'signal');assert.equal(e.playerHealth,2);assert.ok(e.rig.injuries.alive);report('both disarmed and empty: no automatic duel result');
 const entry=[...e.rig.registry.entries.values()].find(x=>x.id==='player Left shin')!;
 const shot=e.rig.ballistics.shoot(new Vector3().copy(entry.collider.translation()).add(new Vector3(0,0,-3)),new Vector3(0,0,1),60,e.rig.time,new Set([...e.rig.registry.entries.values()].filter(x=>x.actor!=='player'||x.zone!=='shin').map(x=>x.id)),'stop');assert.ok(shot.hits.some(x=>x.colliderId===entry.id),JSON.stringify(shot.hits.map(h=>h.colliderId)));e.playerBody.resolve(shot.hits);for(let i=0;i<360;i++)e.step();assert.ok(e.playerBody.fallen);assert.ok(e.playerBody.body.translation().y<.6);assert.equal(e.playerHealth,2);assert.equal(e.rules.phase,'signal');report('player leg hit causes physical fall without defeat');
}finally{e.dispose()}
for(const mode of ['LOW','MEDIUM','HIGH','POWER'] as const){
 const game=new GameEngine(1,'standing','lab');try{
 for(let i=0;i<360;i++)game.step();game.start(true);game.step();game.rig.grip.dropWeapon('isolate torso acceptance');
 for(let n=0;n<2;n++){game.rig.testShot('torso',mode);game.step();assert.equal(game.rig.injuries.vitals.torsoHits,n+1);assert.equal(game.rules.phase,n===0?'signal':'won')}
 assert.equal(game.rules.resultVisible,false);for(let i=0;i<600;i++)game.step();assert.equal(game.rules.resultVisible,true);report('actual '+mode+' torso shots: exactly two kill, result delayed 5 seconds');
 }finally{game.dispose()}
}
for(const profile of Object.values(WEAPON_PROFILES)){
 const b=await readFile('public'+profile.model);const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');assert.equal(gltf.animations.length,0);
 const pose=weaponPose(new Vector3(0,1.65,12),new Quaternion(),1,1,0);gltf.scene.position.copy(pose.position);gltf.scene.quaternion.copy(pose.rotation);gltf.scene.updateMatrixWorld(true);
 const camera=new PerspectiveCamera(35,16/9,.01,100);camera.position.set(0,1.65,12);camera.updateMatrixWorld();const box=new Box3().setFromObject(gltf.scene),top=new Vector3(0,box.max.y,box.min.z).project(camera),chest=new Vector3(0,1.37,0).project(camera);assert.ok(top.y<chest.y,'weapon below opponent chest');report('distinct model, no animation and unobstructed ADS chest '+profile.name);
}
