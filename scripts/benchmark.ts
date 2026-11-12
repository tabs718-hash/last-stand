/** Host CPU measurements, not browser FPS. Run: node --import tsx scripts/benchmark.ts */
import R from '@dimforge/rapier3d-compat';
import {readFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {GameEngine} from '../src/core/GameEngine';
import {WoundDecals} from '../src/rendering/WoundDecals';
import type {ShotRecord} from '../src/combat/BallisticsSystem';
await R.init();const engine=new GameEngine(1,'standing','lab');
const stats=(values:number[])=>{const a=[...values].sort((a,b)=>a-b);return {samples:a.length,meanMs:values.reduce((a,b)=>a+b,0)/a.length,p50Ms:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)]}};
const measure=(action:()=>void,count:number)=>{for(let i=0;i<20;i++)action();const ms:number[]=[];for(let i=0;i<count;i++){const at=performance.now();action();ms.push(performance.now()-at)}return stats(ms)};
const physics=measure(()=>engine.step(),720);
const bytes=await readFile('public/assets/cowboy.glb');const asset=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const wounds=new WoundDecals(asset.scene,32),empty=measure(()=>wounds.update(),240);
const entry=[...engine.rig.registry.entries.values()].find(e=>e.id==='Chest')!;
const captures:number[]=[];
for(let i=0;i<32;i++){
 const x=-.105+(i%8)*.001,y=1.345;
 const shot:ShotRecord={id:i+1,origin:new Vector3(x,y,3),direction:new Vector3(0,0,-1),initialEnergy:60,time:0,end:new Vector3(x,y,.1),penetrationPolicy:'stop',hits:[{shotId:i+1,colliderId:'Chest',zone:'chest',entry,entryPoint:new Vector3(x,y,.1375),stopPoint:new Vector3(x,y,.1),impactNormal:new Vector3(0,0,1),enteredEnergy:60,remainingEnergy:0,depositedEnergy:60,penetrated:false,impulse:new Vector3()}]};
 const at=performance.now();wounds.captureShot(shot);captures.push(performance.now()-at);
}
const full=measure(()=>wounds.update(),240);
console.log(JSON.stringify({runtime:process.version,platform:process.platform,physics,emptyWounds:empty,marks:wounds.marks.length,woundVertices:wounds.marks.reduce((n,m)=>n+m.anchors.length,0),capture:stats(captures),fullWounds:full},null,2));wounds.dispose();engine.dispose();
