/** Offline QA snapshots of the ACTUAL physical draw; not a runtime animation. */
import R from '@dimforge/rapier3d-compat';import {writeFile} from 'node:fs/promises';
import {GameEngine} from '../src/core/GameEngine';
await R.init();const e=new GameEngine();e.start(true);const frames:unknown[]=[];
for(let i=0;i<=365;i++){
 if([0,84,180,276,360].includes(i))frames.push({time:e.rig.time,phase:e.rig.draw.phase,parts:e.rig.allParts.map(p=>({name:p.name,position:{...p.body.translation()},rotation:{...p.body.rotation()}}))});
 e.step();
}
await writeFile('../qa07-poses.json',JSON.stringify(frames));e.dispose();
