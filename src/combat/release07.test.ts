import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Vector3,Quaternion} from 'three';
import {DuelRules} from './DuelRules';
import {GameEngine} from '../core/GameEngine';
import {Rig,DT} from '../character/Rig';
import {AimInput} from '../input/AimInput';
import {SimulationLoop} from '../core/SimulationLoop';
import {PenetrationSolver,type RayInterval} from './PenetrationSolver';
import {PhysicalSkeletonAdapter} from '../rendering/PhysicalSkeletonAdapter';
import {WoundDecals} from '../rendering/WoundDecals';
const report=(test:string,measurements:unknown={})=>console.log(JSON.stringify({test,passed:true,measurements}));
for(let seed=1;seed<=1000;seed++){const r=new DuelRules(seed);r.start();assert.ok(r.signalAt>=5&&r.signalAt<=10)}
const skip=new DuelRules(1);skip.start(true);skip.update(DT);assert.equal(skip.phase,'signal');report('combat signal waits 5-10 seconds across 1000 seeds; training skips');
await R.init();
for(const won of [true,false]){
 const e=new GameEngine(),loop=new SimulationLoop(e,()=>false);e.start(true);loop.advance(DT);e.rules.finish(won,'test');loop.advance(DT);
 const at=e.rules.finishedAt;assert.equal(e.rules.resultVisible,false);assert.equal(e.acceptsInput,false);
 for(let i=0;i<590;i++)loop.advance(DT);assert.equal(e.rules.resultVisible,false);
 loop.paused=true;for(let i=0;i<60;i++)loop.advance(.1);assert.equal(e.rules.resultVisible,false);assert.equal(e.rules.elapsed-at<5,true);
 loop.paused=false;for(let i=0;i<10;i++)loop.advance(DT);assert.equal(e.rules.resultVisible,true);assert.equal(e.rules.resultReason,'test');assert.equal(e.ai.shots,0);e.dispose();
}report('win and loss stop combat immediately, show results after 5 simulation seconds, respect pause');
const opponent=new GameEngine();try{
 assert.equal(opponent.rig.grip.holstered,true);assert.equal(opponent.rig.grip.held,false);assert.equal(opponent.rig.grip.holster!.numColliders(),5);
 for(const key of ['setTranslation','setRotation'] as const)opponent.rig.grip.weapon[key]=()=>{throw Error('live gun teleport')};
 opponent.start(true);let first=0,previous=new Vector3().copy(opponent.rig.grip.weapon.translation()),maxTravel=0,graspTime=0;const phases=new Set<string>();
 for(let i=0;i<440;i++){
  opponent.step();phases.add(opponent.rig.draw.phase);const g=opponent.rig.grip;assert.ok(!(g.holsterJoint&&g.weaponJoint));
  const p=new Vector3().copy(g.weapon.translation());maxTravel=Math.max(maxTravel,p.distanceTo(previous));previous=p;
  if(g.held&&!graspTime)graspTime=opponent.rules.sinceSignal;
  if(opponent.ai.shots){first=opponent.rules.sinceSignal;break}
 }
 assert.ok(graspTime>.25&&graspTime<1.5);assert.ok(phases.has('reaching')&&phases.has('extracting')&&phases.has('raising')&&phases.has('ready'));
 assert.ok(first>=3&&first<3.4);assert.ok(maxTravel<.065);assert.equal(opponent.rules.phase,'signal');assert.equal(opponent.playerHealth,1);
 report('physical opponent holster, reach/grasp/extract/raise, no teleport or duplicate weld',{graspTime,firstShot:first,maxTravel});
}finally{opponent.dispose()}
const player=new GameEngine();try{
 const eq=player.playerEquipment!;assert.ok(eq.mount&&!eq.handJoint);player.start(true);player.step();
 const a=new AimInput().snapshot();player.trigger(a.camera,a.direction,a.muzzle);player.step();assert.equal(player.rules.playerAmmo,6);
 for(let i=0;i<14;i++)player.step();assert.ok(eq.mount);for(let i=0;i<100;i++)player.step();assert.equal(eq.mount,null);assert.ok(eq.handJoint&&eq.ready);
 const expected=new Vector3(0,.025,.178).applyQuaternion(new Quaternion().copy(eq.gun.rotation())).add(eq.gun.translation());assert.ok(eq.muzzle().distanceTo(expected)<1e-8);
 player.trigger(a.camera,a.direction,eq.muzzle());player.step();assert.equal(player.rules.playerAmmo,5);report('player gun starts in physical holster, first LMB draws, live muzzle follows held body');
}finally{player.dispose()}
const injured=new GameEngine();try{
 injured.rig.part('Right hand').functionality=.1;injured.start(true);for(let i=0;i<500;i++)injured.step();assert.equal(injured.ai.shots,0);assert.equal(injured.rig.grip.holstered,true);assert.equal(injured.rig.grip.held,false);report('injured hand cannot silently acquire or fire holstered gun');
}finally{injured.dispose()}
const rig=new Rig();try{
 const part=rig.part('Chest'),entry=[...rig.registry.entries.values()].find(e=>e.part===part)!;
 const interval:RayInterval={entry:{...entry,resistance:10000,coreResistance:40000},zone:'chest',start:1,end:1.25,normal:new Vector3(0,0,1),core:[1.05,1.20]};
 const origin=new Vector3(0,1.37,2),direction=new Vector3(0,0,-1),solver=new PenetrationSolver();
 for(const energy of [60,220]){const hits=solver.solve(1,origin,direction,energy,[interval],'stop');assert.equal(hits[0].penetrated,false);assert.equal(hits[0].exitPoint,undefined);assert.ok(hits[0].stopPoint);assert.ok(Math.abs(hits[0].depositedEnergy-energy)<1e-5)}
 const high=solver.solve(2,origin,direction,540,[interval],'through');assert.equal(high[0].penetrated,true);assert.ok(high[0].exitPoint);assert.ok(high[0].remainingEnergy>0);assert.ok(high[0].depositedEnergy<540);
 report('two stop-in-body weapon profiles and powerful through-body policy preserve energy');
 const bytes=await readFile('public/assets/cowboy.glb');const avatar=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const adapter=new PhysicalSkeletonAdapter(avatar.scene,rig),wounds=new WoundDecals(avatar.scene);
 const off=rig.ballistics.events.on('shot',s=>{adapter.update(1);wounds.captureShot(s)});
 rig.step();rig.testShot('torso','HIGH');rig.step();assert.equal(wounds.marks.filter(m=>m.kind==='entry').length,1);assert.equal(wounds.marks.filter(m=>m.kind==='exit').length,1);assert.ok(wounds.marks[0].anchors.length>100,'garment patch instead of a tiny button');assert.ok(wounds.markCenter(1)!.z<-.14,'exit must be on outer waistcoat, not hidden on shirt');
 const before=wounds.markCenter(0)!.clone();rig.active=false;for(let i=0;i<240;i++)rig.step();adapter.update(1);wounds.update();assert.ok(wounds.markCenter(0)!.distanceTo(before)>.2);const captured=rig.ballistics.lastShot!;
 const physical=rig.parts.map(p=>({...p.body.translation()})),late=new WoundDecals(avatar.scene);
 adapter.updateFromPose(captured.bodyPose!);late.captureShot(captured);adapter.update(1);late.update();assert.ok(late.markCenter(0)!.distanceTo(wounds.markCenter(0)!)<1e-5,'late asset replay retains shot-time surface anchor');
 rig.parts.forEach((p,i)=>assert.deepEqual({...p.body.translation()},physical[i]));late.dispose();wounds.dispose();off();
 report('actual ballistic shot creates paired garment wounds that follow a physical fall');
}finally{rig.dispose()}

const lab=new GameEngine(1,'standing','lab');try{for(let i=0;i<3600;i++)lab.step();assert.ok(lab.rig.part('Pelvis').body.translation().y>.9);assert.equal(lab.rig.grip.holstered,true);assert.equal(lab.rig.grip.held,false);assert.equal(lab.ai.shots,0);report('laboratory starts holstered and keeps a 30-second active stance')}finally{lab.dispose()}
