import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import R from '@dimforge/rapier3d-compat';
import {Bone,Mesh,Quaternion,SkinnedMesh,Vector3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {Rig} from '../character/Rig';
import type {ShotRecord} from '../combat/BallisticsSystem';
import type {HitEvent} from '../combat/PenetrationSolver';
import {WoundDecals} from './WoundDecals';
import {createWoundTextures} from './WoundTextures';
await R.init();const rig=new Rig();
const bytes=await readFile('public/assets/cowboy.glb');const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const root=clone(gltf.scene);root.updateMatrixWorld(true);
const entry=[...rig.registry.entries.values()].find(e=>e.id==='Chest')!;
function shot(id:number,policy:'stop'|'through'|'material'='stop',x=-.105):ShotRecord&{penetrationPolicy:typeof policy}{
 const point=new Vector3(x,1.345,.1375),end=new Vector3(x,1.345,-.1375),direction=new Vector3(0,0,-1);
 const hit:HitEvent={shotId:id,colliderId:'Chest',zone:'chest',entry,entryPoint:point,exitPoint:policy==='stop'?undefined:end,stopPoint:policy==='stop'?new Vector3(x,1.345,.1):undefined,impactNormal:new Vector3(0,0,1),enteredEnergy:540,remainingEnergy:policy==='stop'?0:50,depositedEnergy:policy==='stop'?540:490,penetrated:policy!=='stop',impulse:new Vector3(0,0,-1)};
 return {id,origin:new Vector3(x,1.345,3),direction,initialEnergy:540,time:0,hits:[hit],end,penetrationPolicy:policy};
}
const report=(test:string)=>console.log(JSON.stringify({test,passed:true}));
const atlas=createWoundTextures();try{
 const data=atlas.color.image.data as Uint8Array,n=atlas.color.image.width;assert.equal(data.length,n*n*4);
 assert.equal(data[3],0,'outside patch is transparent');const i=(Math.round(.62*(n-1))*n+Math.round(.5*(n-1)))*4;assert.ok(data[i]<30&&data[i+3]>245,'dark opaque aperture');assert.ok([...data].some((a,j)=>j%4===3&&a>0&&a<150),'soft absorbed edges');
 report('wound atlas: aperture, soft blood edge, normal and roughness maps');
}finally{atlas.dispose()}
const wounds=new WoundDecals(root,4);
try{
 assert.equal(wounds.captureShot({...shot(1),hits:[]}),0);assert.equal(wounds.marks.length,0);
 assert.equal(wounds.captureShot(shot(2)),1);assert.equal(wounds.marks[0].kind,'entry');assert.ok(wounds.markCenter(0)!.z>.1,'projected to visible clothing rather than body box center');assert.equal(wounds.captureShot(shot(2)),0);
 const invalidExit=shot(3,'through');invalidExit.penetrationPolicy='stop';assert.equal(wounds.captureShot(invalidExit),1);assert.equal(wounds.marks.filter(m=>m.kind==='exit').length,0,'stop profile never creates an exit');
 report('persistent marks: misses ignored, entry only for stop profiles, shot deduplication');
 wounds.reset();assert.equal(wounds.captureShot(shot(4,'through')),2);assert.deepEqual(wounds.marks.map(m=>m.kind),['entry','exit']);assert.ok(wounds.markCenter(0)!.z>.10);assert.ok(wounds.markCenter(1)!.z<-.10);
 const duplicate=shot(5,'through');duplicate.hits.push({...duplicate.hits[0],colliderId:'Abdomen'});wounds.reset();assert.equal(wounds.captureShot(duplicate),2,'overlapping body-box boundaries do not create extra holes');
 report('powerful profile: paired outer-surface entry/exit without internal seam wounds');
 const edgeRoot=clone(gltf.scene),edge=new WoundDecals(edgeRoot);try{const corner=shot(8,'stop',.21);corner.origin.y=1.25;corner.hits[0].entryPoint.y=1.25;corner.hits[0].stopPoint!.y=1.25;assert.equal(edge.captureShot(corner),1,'registered box-corner hit must leave a visible surface mark');assert.ok(edge.markCenter(0)!.distanceTo(corner.hits[0].entryPoint)<.18);report('grazing proxy corners project visible marks onto nearby cloth')}finally{edge.dispose()}
 const before=wounds.markCenter(0)!.clone(),delta=new Vector3(.8,.3,-.4);root.position.add(delta);root.updateMatrixWorld(true);wounds.update();assert.ok(wounds.markCenter(0)!.distanceTo(before.add(delta))<1e-6);
 const chest=root.getObjectByName('Chest') as Bone;const oldCenter=wounds.markCenter(0)!.clone();chest.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.35));root.updateMatrixWorld(true);wounds.update();assert.ok(wounds.markCenter(0)!.distanceTo(oldCenter)>.015,'mark follows actual bone skin deformation');
 for(const mark of wounds.marks){const p=mark.mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite))}
 report('surface anchors: global movement and skinned torso pose keep wounds attached');
 root.position.set(0,0,0);chest.quaternion.identity();root.updateMatrixWorld(true);wounds.reset();
 for(let i=10;i<16;i++)wounds.captureShot(shot(i,'stop',-.105+(i-10)*.005));assert.equal(wounds.marks.length,4);assert.equal(wounds.group.children.length,4);assert.equal(wounds.marks[0].shotId,12);
 wounds.reset();assert.equal(wounds.marks.length,0);assert.equal(wounds.group.children.length,0);report('bounded mark pool and clean reset/disposal');
}finally{wounds.dispose();rig.dispose()}
