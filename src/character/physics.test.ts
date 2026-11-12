import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {Rig,DT} from './Rig';
import {anatomicalRanges} from '../physics/JointLimits';
await R.init();
const advance=(rig:Rig,seconds:number)=>{for(let i=0;i<Math.round(seconds/DT);i++){rig.step();for(const p of rig.allParts)assert.ok(Object.values(p.body.translation()).every(Number.isFinite),'finite transforms')}};
const report=(name:string,measurements:unknown)=>console.log(JSON.stringify({test:name,passed:true,measurements}));
const rig=new Rig();
try{
  assert.equal(rig.parts.length,16);assert.equal(rig.muscles.length,15);
  assert.ok(rig.parts.reduce((s,p)=>s+p.mass,0)>=75);
  for(const m of rig.muscles){
    assert.equal(m.joint.body1().isDynamic(),true);assert.equal(m.joint.body2().isDynamic(),true);
    if(!m.hinge){const ranges=anatomicalRanges(m.b.name);for(const [i,axis] of [3,4,5].entries())assert.ok(Math.abs(rig.world.impulseJoints.raw.jointLimitsMax(m.joint.handle,axis)-ranges[i][1])<1e-6)}
  }
  let minimum=Infinity,maxSettledSpeed=0;
  for(let i=0;i<3600;i++){rig.step();minimum=Math.min(minimum,rig.part('Pelvis').body.translation().y);if(i>1200)maxSettledSpeed=Math.max(maxSettledSpeed,new Vector3().copy(rig.part('Chest').body.angvel()).length())}
  assert.ok(minimum>.9);assert.ok(maxSettledSpeed<.15);assert.equal(rig.contacts,2);assert.ok(rig.balance.support.hull.length>=3);assert.ok(rig.balance.margin>0);
  report('30-second standing',{minimumPelvis:minimum,maxSettledAngularSpeed:maxSettledSpeed,supportMargin:rig.balance.margin});
  const before=rig.com.clone();rig.impulse(25);let excursion=0,tilt=0;
  for(let i=0;i<960;i++){rig.step();excursion=Math.max(excursion,Math.abs(rig.com.x-before.x));tilt=Math.max(tilt,Math.abs(rig.part('Chest').body.rotation().z))}
  assert.ok(excursion>.02);assert.ok(tilt>.005);assert.ok(rig.part('Pelvis').body.translation().y>.9);assert.ok(Math.abs(rig.com.x-before.x)<.02);
  report('impulse recovery',{excursion,tilt,finalCOM:rig.com.toArray()});
  rig.active=false;advance(rig,5);assert.ok(rig.part('Pelvis').body.translation().y<.5);report('passive collapse',{pelvis:rig.part('Pelvis').body.translation()});
}finally{rig.dispose()}
const strong=new Rig();try{advance(strong,3);strong.impulse(60);advance(strong,8);assert.ok(strong.part('Pelvis').body.translation().y<.5);report('finite muscle authority',{pelvis:strong.part('Pelvis').body.translation()})}finally{strong.dispose()}
const replay=()=>{const r=new Rig();try{advance(r,1);r.impulse(9);advance(r,2);return r.parts.flatMap(p=>Object.values(p.body.translation()))}finally{r.dispose()}};
const a=replay(),b=replay();assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-5));report('fixed initial conditions replay',{maxError:Math.max(...a.map((v,i)=>Math.abs(v-b[i])))});
