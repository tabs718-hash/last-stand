import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import R from '@dimforge/rapier3d-compat';
import {Bone,Box3,Group,Mesh,Quaternion,SkinnedMesh,Triangle,Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {AssetCache} from '../rendering/AssetCache';
import {createWoundTextures} from '../rendering/WoundTextures';
import {WoundDecals} from '../rendering/WoundDecals';
import {createStreet} from '../rendering/StreetGeometry';
import {GameEngine} from './GameEngine';
import {loadGameRuntime} from './GameRuntime';
import type {ShotRecord} from '../combat/BallisticsSystem';
const report=(test:string,measurements:unknown={})=>console.log(JSON.stringify({test,passed:true,measurements}));
let attempts=0;const cache=new AssetCache(async(url:string)=>{attempts++;if(attempts===1)throw Error('temporary network failure');return {url}});
const first=cache.load('cowboy');assert.equal(first,cache.load('cowboy'));await assert.rejects(first);assert.deepEqual(cache.getStatus().failedUrls,['cowboy']);
let retried=0;const off=cache.subscribeRetry(()=>retried++);cache.retry();assert.equal(retried,1);assert.equal(cache.getStatus().failedUrls.length,0);
const recovered=await cache.load('cowboy');assert.equal(recovered.url,'cowboy');assert.equal(await cache.load('cowboy'),recovered);assert.equal(attempts,2);off();cache.retry();assert.equal(retried,1);
report('transient asset failure recovers, concurrent requests deduplicate, retry listeners clean up');
const a=createWoundTextures(),b=createWoundTextures(),exit=createWoundTextures(true);
assert.notEqual(a.color,b.color);assert.equal(a.color.image.data,b.color.image.data);assert.notEqual(a.color.image.data,exit.color.image.data);
let bDisposals=0;b.color.addEventListener('dispose',()=>bDisposals++);a.dispose();assert.equal(bDisposals,0);b.dispose();assert.equal(bDisposals,1);exit.dispose();assert.throws(()=>createWoundTextures(false,0),RangeError);
report('immutable atlas pixels reused across resets, GPU texture ownership stays independent');
const street=createStreet();const bounds=new Box3().setFromObject(street.group);assert.equal(street.stats.pieces,192);assert.ok(street.stats.drawCalls<=12);assert.ok(Math.abs(bounds.min.x+8.15)<1e-5&&Math.abs(bounds.max.x-8.15)<1e-5);
let disposed=0;for(const o of street.group.children)(o as Mesh).geometry.addEventListener('dispose',()=>disposed++);const meshes=street.group.children.length;street.dispose();assert.equal(disposed,meshes);assert.equal(street.group.children.length,0);report('street batching preserves 192-piece layout and releases merged GPU buffers',street.stats);
await R.init();const engine=new GameEngine();let frees=0;const free=engine.rig.world.free.bind(engine.rig.world);engine.rig.world.free=()=>{frees++;free()};engine.start(true);engine.step();engine.dispose();engine.dispose();
const time=engine.rules.elapsed;engine.start(true);engine.step();assert.equal(engine.rules.elapsed,time);assert.equal(frees,1);const aim=new Vector3(0,0,-1);assert.equal(engine.trigger(new Vector3(0,1.65,12),aim,new Vector3(.19,1.45,11.39)),false);
report('world teardown is idempotent, cancelled/stale sessions cannot accept combat input');
const r1=loadGameRuntime(),r2=loadGameRuntime();assert.equal(r1,r2);const runtime=await r1;const fresh=runtime.createEngine(1,'standing','lab');assert.equal(fresh.physicsVersion,R.version());assert.equal(fresh.rig.grip.holstered,true);fresh.dispose();report('deferred physics runtime initializes once and creates ready sessions');
const e=new GameEngine(1,'standing','lab');try{
 const bytes=await readFile('public/assets/cowboy.glb'),g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const root=g.scene,wounds=new WoundDecals(root,4),entry=[...e.rig.registry.entries.values()].find(e=>e.id==='Chest')!;
 for(let id=1;id<=10;id++){
  const x=-.105+id*.0007,y=1.345;const shot:ShotRecord={id,time:0,origin:new Vector3(x,y,3),direction:new Vector3(0,0,-1),end:new Vector3(x,y,.1),initialEnergy:60,penetrationPolicy:'stop',hits:[{shotId:id,colliderId:'Chest',zone:'chest',entry,entryPoint:new Vector3(x,y,.1375),stopPoint:new Vector3(x,y,.1),impactNormal:new Vector3(0,0,1),enteredEnergy:60,remainingEnergy:0,depositedEnergy:60,penetrated:false,impulse:new Vector3()}]};wounds.captureShot(shot);
 }
 root.position.set(.5,.3,-.1);(root.getObjectByName('Chest') as Bone).quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.28));root.updateMatrixWorld(true);
 const parent=new Group();parent.position.set(.2,-.1,.4);parent.add(wounds.group);parent.updateMatrixWorld(true);wounds.update();assert.equal(wounds.marks.length,4);
 const inv=wounds.group.matrixWorld.clone().invert();let maxError=0;
 for(const mark of wounds.marks){const p=mark.mesh.geometry.getAttribute('position');for(let i=0;i<mark.anchors.length;i++){
  const anchor=mark.anchors[i],mesh=anchor.mesh;
  const vertices=anchor.indices.map(index=>{const v=new Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'),index);if(mesh instanceof SkinnedMesh)mesh.applyBoneTransform(index,v);return v.applyMatrix4(mesh.matrixWorld)});
  const normal=new Triangle(...vertices as [Vector3,Vector3,Vector3]).getNormal(new Vector3());const expected=vertices[0].clone().multiplyScalar(anchor.bary.x).addScaledVector(vertices[1],anchor.bary.y).addScaledVector(vertices[2],anchor.bary.z).addScaledVector(normal,.00065).applyMatrix4(inv);
  maxError=Math.max(maxError,new Vector3().fromBufferAttribute(p,i).distanceTo(expected));
 }}assert.ok(maxError<1e-6);wounds.reset();wounds.update();assert.equal(wounds.group.children.length,0);wounds.dispose();report('optimized wound buffers match reference skinning after pose, group transform and pool eviction',{maxError});
}finally{e.dispose()}
// Exercise repeated complete world lifetimes rather than just construction.
for(let i=0;i<12;i++){const game=new GameEngine(1,'standing',i%2?'duel':'lab');for(let j=0;j<90;j++)game.step();game.dispose();game.dispose()}
report('twelve consecutive lab/duel world lifetimes initialize, advance and release cleanly');
