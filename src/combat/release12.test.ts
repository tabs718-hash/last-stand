import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Vector3,Mesh,SkinnedMesh,ShaderLib} from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {readFile} from 'node:fs/promises';
import {Rig} from '../character/Rig';
import {VitalState} from './VitalState';
import {WoundDecals} from '../rendering/WoundDecals';
import {PhysicalSkeletonAdapter} from '../rendering/PhysicalSkeletonAdapter';
const advance=(r:Rig,n:number)=>{for(let i=0;i<n;i++)r.step()};
const report=(test:string,data:unknown={})=>console.log(JSON.stringify({test,passed:true,data}));
const secondaryHead=new VitalState();secondaryHead.apply('upperArm',1,60);secondaryHead.apply('head',1,20);assert.ok(!secondaryHead.alive,'a real head impact still kills after a limb intersection');
await R.init();
const impulses=new Map<string,number>();
for(const target of ['leftArm','rightArm','leftLeg','rightLeg','torso','head'] as const){
 for(const mode of ['HIGH','POWER'] as const){const r=new Rig();try{
 advance(r,360);const name=target==='leftArm'?'Left hand':target==='rightArm'?'Right hand':target==='leftLeg'?'Left shin':target==='rightLeg'?'Right shin':target==='head'?'Head':'Chest',part=r.part(name),before=new Vector3().copy(part.body.translation());
 r.testShot(target,mode);r.step();const shot=r.ballistics.lastShot!,imp=shot.hits.filter(h=>h.entry.part).reduce((s,h)=>s+h.impulse.length(),0);impulses.set(target+mode,imp);assert.ok(imp>0);
 let maxForward=0;for(let i=0;i<23;i++){r.step();maxForward=Math.max(maxForward,new Vector3().copy(part.body.translation()).sub(before).dot(shot.direction))}assert.ok(maxForward>(target.includes('Leg')?.0001:.001),'impact moves struck chain in projectile direction '+target+mode+' '+maxForward);
 if(target.includes('Arm')||target.includes('Leg'))assert.ok(r.injuries.alive);
 if(target==='head'&&mode==='POWER'){
 assert.equal(r.fragments.pieces.length,18);assert.ok(r.part('Head').destroyed);assert.ok([...r.registry.entries.values()].filter(e=>e.part?.name==='Head').every(e=>!e.collider.isEnabled()));const positions=r.fragments.pieces.map(p=>new Vector3().copy(p.body.translation()));
 advance(r,240);assert.equal(r.fragments.pieces.length,18);r.fragments.pieces.forEach((p,i)=>{assert.ok(new Vector3().copy(p.body.translation()).distanceTo(positions[i])>.1);assert.ok(Object.values(p.body.translation()).every(Number.isFinite));assert.ok(p.body.translation().y>-.2)});
 }
 }finally{r.dispose()}}
 assert.ok(impulses.get(target+'POWER')!>impulses.get(target+'HIGH')!*8);report('Power Gun >8x Magnum body impulse: '+target,{magnum:impulses.get(target+'HIGH'),power:impulses.get(target+'POWER')});
}
for(const side of ['Left','Right'])for(const mode of ['LOW','MEDIUM','HIGH','POWER'] as const){const r=new Rig();try{
 advance(r,360);const shin=r.part(side+' shin'),before=new Vector3().copy(shin.body.translation());r.testShot(side==='Left'?'leftLeg':'rightLeg',mode);r.step();
 for(const p of r.allParts){p.body.setTranslation=()=>{throw Error('live transform write')};p.body.setRotation=()=>{throw Error('live transform write')}}
 advance(r,23);assert.ok(r.balance.enabled);assert.ok(r.muscles.filter(m=>m.b.name.startsWith(side==='Left'?'Right':'Left')).some(m=>m.limit>10),'healthy side tries to brace');assert.ok(r.part('Pelvis').body.translation().y>.75,'stagger before collapse');assert.ok(new Vector3().copy(shin.body.translation()).distanceTo(before)>.003,'visible leg response');advance(r,337);assert.ok(r.part('Pelvis').body.translation().y<.5);assert.ok(r.injuries.alive);
 }finally{r.dispose()}}
report('all four weapons, both legs: impact, active healthy-side brace, physical nonlethal fall');
const bytes=await readFile('public/assets/cowboy.glb');
for(const mode of ['LOW','MEDIUM','HIGH','POWER'] as const){const r=new Rig();try{
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''),adapter=new PhysicalSkeletonAdapter(gltf.scene,r),wounds=new WoundDecals(gltf.scene);r.ballistics.events.on('shot',s=>{adapter.update(1);wounds.captureShot(s)});r.step();r.testShot('torso',mode);r.step();adapter.update(1);wounds.update();
 if(mode==='LOW'||mode==='MEDIUM'){assert.equal(wounds.channels.length,0);assert.equal(wounds.marks.length,1);assert.equal(wounds.surface.uniforms.damageCount.value,0)}else{
 assert.equal(wounds.channels.length,1);assert.equal(wounds.marks.length,2);const c=wounds.channels[0],a=wounds.markCenter(0)!,b=wounds.markCenter(1)!;assert.ok(wounds.surface.cutAt(a.clone().lerp(b,.5)));assert.ok(wounds.surface.cutAt(a));assert.ok(wounds.surface.cutAt(b));assert.ok(!wounds.surface.cutAt(a.clone().add(new Vector3(.2,0,0))));assert.ok(c.entryRadius>=.022&&c.exitRadius>c.entryRadius);assert.equal((c.mesh.geometry as any).parameters.openEnded,true);
 const before=a.clone();r.active=false;advance(r,240);adapter.update(1);wounds.update();assert.ok(wounds.markCenter(0)!.distanceTo(before)>.2);assert.ok(wounds.surface.cutAt(wounds.markCenter(0)!));
 gltf.scene.traverse(o=>{if(o instanceof Mesh){for(const material of Array.isArray(o.material)?o.material:[o.material]){const shader={uniforms:{},vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader as any,{} as any);assert.ok(shader.vertexShader.includes('vDamageWorld=(modelMatrix'));assert.ok(shader.fragmentShader.includes('radial,radial)<radius*radius'))}const depth={uniforms:{},vertexShader:ShaderLib.depth.vertexShader,fragmentShader:ShaderLib.depth.fragmentShader};o.customDepthMaterial!.onBeforeCompile(depth as any,{} as any);assert.ok(depth.vertexShader.includes('vDamageWorld=(modelMatrix'));}});
 }
 if(mode==='POWER'){const center=new Vector3().copy(r.part('Head').body.translation());wounds.destroyHead(center);assert.ok(wounds.surface.cutAt(center));assert.ok(!wounds.surface.cutAt(center.clone().add(new Vector3(.5,0,0))))}
 wounds.dispose();report('distinct damage presentation '+mode);
 }finally{r.dispose()}}
