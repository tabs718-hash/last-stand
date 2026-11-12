import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import R from '@dimforge/rapier3d-compat';
import {Matrix4,Quaternion,SkinnedMesh,Vector3,Box3} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {Rig} from '../character/Rig';
import {PhysicalSkeletonAdapter} from './PhysicalSkeletonAdapter';
await R.init();
async function load(name:string){const b=await readFile('public/assets/'+name+'.glb');return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const gltf=await load('cowboy');assert.equal(gltf.animations.length,0);
let vertices=0;
gltf.scene.traverse(o=>{if(o instanceof SkinnedMesh){const w=o.geometry.getAttribute('skinWeight');for(let i=0;i<w.count;i++){assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5);vertices++}}});
assert.ok(vertices>2000);console.log('PASS avatar: normalized skin weights and no scripted animations');
for(const pose of ['standing','supine'] as const){
 const rig=new Rig(pose),root=clone(gltf.scene);root.updateMatrixWorld(true);
 const rest=new Map<string,Matrix4>();for(const p of rig.parts)rest.set(p.name,root.getObjectByName(p.name.replaceAll(' ','_'))!.matrixWorld.clone());
 const sourceBone=gltf.scene.getObjectByName('Pelvis')!.matrixWorld.clone();
 const adapter=new PhysicalSkeletonAdapter(root,rig);adapter.update(1);
 assert.deepEqual(gltf.scene.getObjectByName('Pelvis')!.matrixWorld.elements,sourceBone.elements,'clones do not mutate cached skeleton');
 function check(){for(const p of rig.parts){const expected=new Matrix4().compose(new Vector3().copy(p.body.translation()),new Quaternion().copy(p.body.rotation()),new Vector3(1,1,1)).multiply(rig.bindPose.get(p.name)!.clone().invert()).multiply(rest.get(p.name)!);const actual=root.getObjectByName(p.name.replaceAll(' ','_'))!.matrixWorld;assert.ok(actual.elements.every((n,i)=>Math.abs(n-expected.elements[i])<1e-5),p.name)}}
 check();rig.impulse(32);for(let i=0;i<180;i++)rig.step();adapter.update(1);check();
 const physicsBefore=rig.parts.map(p=>({...p.body.translation(),...p.body.rotation()}));
 adapter.update(.5);root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite),'finite interpolated matrices'));
 assert.deepEqual(rig.parts.map(p=>({...p.body.translation(),...p.body.rotation()})),physicsBefore,'visual adapter never writes physics');adapter.update(1);
 root.traverse(o=>{if(o instanceof SkinnedMesh){o.skeleton.update();const pos=o.geometry.getAttribute('position');for(let i=0;i<pos.count;i+=31){const v=new Vector3().fromBufferAttribute(pos,i);o.applyBoneTransform(i,v);assert.ok(v.toArray().every(Number.isFinite))}}});
 rig.dispose();console.log('PASS skeleton: '+pose+' canonical bind and dynamic impulse pose');
}
for(const name of ['revolver','hat']){const g=await load(name);const size=new Box3().setFromObject(g.scene).getSize(new Vector3());assert.ok(size.x>0&&size.x<.5&&size.y>0&&size.y<.3&&size.z>.1&&size.z<.5);assert.equal(g.animations.length,0);console.log('PASS prop: '+name+' scale and geometry')}
