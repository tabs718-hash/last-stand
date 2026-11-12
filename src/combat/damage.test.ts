import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Rig} from '../character/Rig';
await R.init();
const advance=(r:Rig,seconds:number)=>{for(let i=0;i<seconds*120;i++)r.step()};
for(const [target,mode] of [['knee','LOW'],['knee','HIGH'],['hand','HIGH'],['weapon','HIGH'],['head','HIGH']] as const){
 const r=new Rig();try{
  advance(r,3);r.testShot(target,mode);r.step();
  const shot=r.ballistics.lastShot!;assert.ok(shot.hits.length>0);
  const totalImpulse=shot.hits.reduce((s,h)=>s+h.impulse.length(),0);
  assert.ok(totalImpulse<=Math.sqrt(2*.014*shot.initialEnergy)+1e-8);
  if(target==='knee'){
   assert.equal(shot.hits[0].zone,'knee');assert.equal(shot.hits[0].penetrated,mode==='HIGH');
   assert.ok(r.part('Right shin').functionality<1);assert.equal(r.part('Left shin').functionality,1);assert.equal(r.part('Right hand').functionality,1);
   assert.equal(r.grip.held,true,'knee injury must not directly release a healthy hand');
   advance(r,8);assert.equal(r.injuries.consciousness,1);assert.equal(r.part('Right hand').functionality,1);
   assert.ok(r.part('Pelvis').body.translation().y<.5);
  }
  if(target==='weapon'){
   assert.equal(shot.hits[0].zone,'weapon');assert.equal(r.part('Right hand').functionality,1);assert.equal(r.grip.held,false);
   assert.ok(r.grip.weapon.linvel().z<-.01);const initialY=r.grip.weapon.translation().y;advance(r,2);assert.ok(r.grip.weapon.translation().y<initialY-.1);
  }
  if(target==='hand'){
   assert.equal(shot.hits[0].zone,'hand');assert.ok(r.part('Right hand').functionality<1);assert.equal(r.grip.held,false);assert.equal(r.injuries.consciousness,1);
  }
  if(target==='head'){
   assert.equal(r.injuries.consciousness,0);assert.equal(r.grip.held,false);assert.equal(r.grip.hatJoint,null);advance(r,5);assert.ok(r.part('Pelvis').body.translation().y<.5);assert.ok(r.consciousActivation<.001);
  }
  console.log(JSON.stringify({test:target,mode,passed:true,pelvis:r.part('Pelvis').body.translation().y,consciousness:r.injuries.consciousness,held:r.grip.held,hits:shot.hits.map(h=>({zone:h.zone,energy:h.depositedEnergy,penetrated:h.penetrated}))}));
 }finally{r.dispose()}
}
