import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {CollisionRegistry} from '../physics/CollisionRegistry';
import {BallisticsSystem} from './BallisticsSystem';
await R.init();
const world=new R.World({x:0,y:0,z:0}),registry=new CollisionRegistry();
const box=(id:string,position:Vector3,size:[number,number,number],resistance=900,coreResistance=1300)=>{
 const collider=world.createCollider(R.ColliderDesc.cuboid(size[0]/2,size[1]/2,size[2]/2).setTranslation(position.x,position.y,position.z));
 return registry.add({id,collider,zone:'chest',size,resistance,surfaceLoss:6,coreResistance});
};
try{
 box('target',new Vector3(),[2,1,.2]);world.step();
 const system=new BallisticsSystem(world,registry),direction=new Vector3(0,0,-1);
 const low=system.shoot(new Vector3(0,0,2),direction,60,0).hits[0];
 assert.equal(low.penetrated,false);assert.ok(low.stopPoint);assert.equal(low.exitPoint,undefined);assert.ok(Math.abs(low.depositedEnergy-60)<1e-6);
 const high=system.shoot(new Vector3(0,0,2),direction,540,0).hits[0];
 assert.equal(high.penetrated,true);assert.ok(high.exitPoint);assert.ok(Math.abs(high.entryPoint.distanceTo(high.exitPoint!)-.2)<1e-5);assert.ok(Math.abs(high.remainingEnergy-211)<1e-3);
 const angled=new Vector3(Math.sqrt(3)/2,0,-.5);
 const oblique=system.shoot(angled.clone().multiplyScalar(-2),angled,540,0).hits[0];
 assert.equal(oblique.penetrated,false);assert.ok(oblique.depositedEnergy>high.depositedEnergy);
 const overlap=box('overlap',new Vector3(0,0,-.1),[2,1,.2]);world.step();
 const layered=system.shoot(new Vector3(0,0,2),direction,540,0).hits;
 assert.equal(layered.length,2);assert.equal(new Set(layered.map(h=>h.colliderId)).size,2);assert.ok(Math.abs(layered.reduce((s,h)=>s+h.depositedEnergy,0)-540)<1e-6);assert.ok(layered.some(h=>h.stopPoint));
 world.removeCollider(overlap.collider,true);registry.entries.delete(overlap.collider.handle);
 box('muzzle obstruction',new Vector3(.389,0,2.2),[.13,1,.1],18000,0);world.step();
 const blocked=system.fromCamera(new Vector3(0,0,3),direction,new Vector3(.5,0,2.8),540,0);
 assert.equal(blocked.hits[0].colliderId,'muzzle obstruction');assert.equal(blocked.hits.length,1);
 console.log(JSON.stringify({test:'ballistics geometry, energy, overlapping materials, muzzle obstruction',passed:true}));
}finally{world.free()}
