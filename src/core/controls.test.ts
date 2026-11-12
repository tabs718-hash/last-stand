import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {DT,Rig} from '../character/Rig';
import {targetPoses} from '../character/TargetPose';
import {MUZZLE_LOCAL} from '../input/WeaponPresentation';
import {AimInput} from '../input/AimInput';
import {GameEngine} from './GameEngine';
import {SimulationLoop} from './SimulationLoop';
const report=(test:string,measurements:unknown={})=>console.log(JSON.stringify({test,passed:true,measurements}));
for(const speed of [1,.5,.25]){
 let steps=0,enabled=true,hidden=false;
 const loop=new SimulationLoop({step(){steps++},setInputEnabled(value){enabled=value}},()=>hidden);
 loop.timeScale=speed;
 for(let i=0;i<120;i++)loop.advance(1/60);
 assert.equal(steps,240*speed);
 loop.paused=true;assert.equal(enabled,false);const saved=steps;
 loop.advance(10);assert.equal(steps,saved);assert.equal(loop.singleStep(),true);assert.equal(steps,saved+1);
 hidden=true;assert.equal(loop.singleStep(),false);loop.paused=false;loop.advance(10);assert.equal(enabled,false);assert.equal(steps,saved+1);
 hidden=false;assert.equal(loop.advance(0),1,'resume must retain the last displayed pose until a new physics tick');assert.equal(steps,saved+1);assert.equal(enabled,true);assert.equal(loop.singleStep(),false);
}
report('fixed timestep slow motion, pause, single step and visibility');
const aim=new AimInput();const before=aim.snapshot();aim.moveRelative(100,-80);const click=aim.snapshot();
assert.ok(click.direction.angleTo(before.direction)>.15);
assert.ok(Math.abs(Math.asin(click.direction.y)-aim.pitch)<1e-8);
assert.ok(click.direction.length()>.9999);
assert.ok(click.muzzle.distanceTo(MUZZLE_LOCAL.clone().applyQuaternion(click.weapon.rotation).add(click.weapon.position))<1e-8);
click.direction.set(0,0,0);assert.ok(aim.snapshot().direction.length()>.9999);
aim.zoom=true;aim.release();assert.equal(aim.zoom,false);
aim.moveRelative(1e6,-1e6);assert.equal(aim.yaw,-.7);assert.equal(aim.pitch,.55);
aim.moveAbsolute(500,250,1000,500);assert.equal(Math.abs(aim.yaw),0);assert.equal(Math.abs(aim.pitch),0);
report('fresh click aim, muzzle transform, bounds and zoom release');
await R.init();
const engine=new GameEngine(),loop=new SimulationLoop(engine,()=>false);
try{
 const phases:string[]=[],shots:number[]=[];
 engine.events.on('phaseChanged',event=>phases.push(event.to));engine.events.on('shot',shot=>shots.push(shot.id));
 engine.start(true);loop.advance(DT);assert.deepEqual(phases,['signal']);
 const input=new AimInput().snapshot();
 assert.equal(engine.trigger(input.camera,input.direction,input.muzzle),true);
 loop.paused=true;
 for(let i=0;i<50;i++)assert.equal(engine.trigger(input.camera,input.direction,input.muzzle),false);
 loop.singleStep();assert.equal(engine.rules.playerDrawAt,Infinity);
 loop.paused=false;loop.advance(DT);assert.equal(engine.rules.playerDrawAt,Infinity);assert.equal(engine.rules.playerAmmo,6);
 engine.trigger(input.camera,input.direction,input.muzzle);loop.advance(DT);
 for(let i=0;i<100;i++)loop.advance(DT);
 const camera=new Vector3(0,1.65,12),direction=new Vector3().copy(engine.rig.part('Head').body.translation()).sub(camera).normalize(),muzzle=new Vector3(.19,1.49,11.35);
 engine.trigger(camera,direction,muzzle);camera.set(100,100,100);direction.set(1,0,0);muzzle.set(100,0,0);
 loop.advance(DT);
 assert.equal(engine.rules.phase,'won');assert.equal(engine.rules.playerAmmo,5);assert.deepEqual(phases,['signal','won']);assert.deepEqual(shots,[1]);
 assert.ok(engine.rig.ballistics.lastShot!.origin.distanceTo(new Vector3(.19,1.49,11.35))<1e-8);
 assert.equal(engine.trigger(input.camera,input.direction,input.muzzle),false);
 report('paused input cancellation, immutable shot snapshot and event delivery');
}finally{engine.dispose()}
const rig=new Rig();try{
 for(let i=0;i<120;i++)rig.step();
 const state=rig.parts.map(p=>({...p.body.translation()}));
 rig.muscles[0].target.setFromAxisAngle(new Vector3(1,0,0),.23);
 rig.muscles[3].target.setFromAxisAngle(new Vector3(0,0,1),-.15);
 const poses=targetPoses(rig.parts[0],rig.muscles,{position:new Vector3(1,2,3),rotation:new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),.4)});
 assert.equal(poses.size,16);
 for(const m of rig.muscles){
  const parent=poses.get(m.a.name)!,child=poses.get(m.b.name)!;
  const a=new Vector3().copy(m.joint.anchor1()).applyQuaternion(parent.rotation).add(parent.position);
  const b=new Vector3().copy(m.joint.anchor2()).applyQuaternion(child.rotation).add(child.position);
  assert.ok(a.distanceTo(b)<1e-7,'target joint anchors must coincide');
  const relative=parent.rotation.clone().invert().multiply(child.rotation).normalize();
  assert.ok(relative.angleTo(m.target.clone().normalize())<1e-6);
 }
 rig.parts.forEach((p,i)=>assert.deepEqual({...p.body.translation()},state[i]));
 report('16-segment target kinematics, joint continuity and read-only diagnostics');
}finally{rig.dispose()}
