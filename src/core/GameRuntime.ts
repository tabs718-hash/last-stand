import type {GameEngine} from './GameEngine';
import type {InitialPose} from '../config/behaviour';
export interface GameRuntime {createEngine(seed?:number,pose?:InitialPose,mode?:'lab'|'duel',distance?:number):GameEngine}
let pending:Promise<GameRuntime>|null=null;
/** Let the page/loading shell paint before loading the sizeable physics/WASM module. */
export function loadGameRuntime(){
 if(!pending)pending=Promise.all([import('@dimforge/rapier3d-compat'),import('./GameEngine')]).then(async([rapier,module])=>{
  await rapier.default.init();return {createEngine:(seed=1,pose:InitialPose='standing',mode:'lab'|'duel'='lab',distance=12)=>new module.GameEngine(seed,pose,mode,distance)};
 }).catch(error=>{pending=null;throw error});return pending;
}
