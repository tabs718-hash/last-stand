import {FIXED_DT as DT} from '../config/ragdoll';
interface Simulation {step():void;setInputEnabled?(enabled:boolean):void}
export class SimulationLoop {
  accumulator=0;
  cost=0;
  fps=60;
  stepsThisFrame=0;
  private stopped=false;
  private holdCurrent=true;
  private scale=1;
  constructor(public rig:Simulation,private isHidden=()=>typeof document!=='undefined'&&document.hidden){}
  get paused(){return this.stopped}
  set paused(value:boolean){
    this.stopped=value;
    this.accumulator=0;this.holdCurrent=true;
    this.rig.setInputEnabled?.(!value&&!this.isHidden());
  }
  get timeScale(){return this.scale}
  set timeScale(value:number){if(Number.isFinite(value)&&value>=.1&&value<=1)this.scale=value}
  singleStep(){
    if(!this.paused||this.isHidden())return false;
    const start=performance.now();
    this.rig.step();this.cost=performance.now()-start;this.accumulator=0;this.stepsThisFrame=1;this.holdCurrent=true;
    return true;
  }
  advance(delta:number){
    this.stepsThisFrame=0;
    const suspended=this.paused||this.isHidden();
    this.rig.setInputEnabled?.(!suspended);
    if(suspended){this.accumulator=0;this.holdCurrent=true;return 1}
    if(!Number.isFinite(delta)||delta<0)return this.holdCurrent?1:this.accumulator/DT;
    if(delta>0)this.fps+=(1/delta-this.fps)*.05;
    this.accumulator+=Math.min(delta,.05)*this.timeScale;
    const start=performance.now();
    while(this.accumulator+1e-12>=DT){
      this.rig.step();this.accumulator=Math.max(0,this.accumulator-DT);this.stepsThisFrame++;
    }
    if(this.stepsThisFrame){this.cost=(performance.now()-start)/this.stepsThisFrame;this.holdCurrent=false}
    return this.holdCurrent?1:this.accumulator/DT;
  }
}
