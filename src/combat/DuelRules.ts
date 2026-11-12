import {SeededRandom} from '../core/SeededRandom';
export type DuelPhase='idle'|'waiting'|'signal'|'won'|'lost';
export type TriggerState='wait'|'holstered'|'drawing'|'ready'|'cooldown'|'empty'|'finished';
export type PlayerAction='draw'|'shot'|'wait'|'drawing'|'cooldown'|'empty'|'ignored'|'disarmed'|'reloading';
export const DRAW_SECONDS=.76,PLAYER_SHOT_INTERVAL=.8,RESULT_DELAY=5;
export class DuelRules {
  phase:DuelPhase='idle';
  elapsed=0;
  signalAt=Infinity;
  playerDrawAt=Infinity;
  playerDrawn=false;
  playerAmmo=6;
  playerShots=0;
  reloadUntil=0;
  playerNextShot=0;
  resultReason='';
  finishedAt=Infinity;
  reactionTime:number|null=null;
  constructor(public seed:number,private random=new SeededRandom(seed)){}
  get terminal(){return this.phase==='won'||this.phase==='lost'}
  start(skipWait=false){if(this.phase!=='idle')return;this.phase='waiting';this.signalAt=this.elapsed+(skipWait?0:5+this.random.next()*5)}
  update(dt:number){this.elapsed+=dt;if(this.phase==='waiting'&&this.elapsed>=this.signalAt)this.phase='signal';if(this.elapsed>=this.playerDrawAt+DRAW_SECONDS)this.playerDrawn=true;if(this.reloadUntil>0&&this.elapsed>=this.reloadUntil){this.playerAmmo=6;this.reloadUntil=0}}
  get triggerState():TriggerState{
    if(this.terminal||this.phase==='idle')return 'finished';
    if(this.phase==='waiting')return 'wait';
    if(!Number.isFinite(this.playerDrawAt))return 'holstered';
    if(!this.playerDrawn)return 'drawing';
    if(this.reloadUntil>this.elapsed)return 'cooldown';
    if(this.playerAmmo<=0)return 'empty';
    return this.elapsed<this.playerNextShot?'cooldown':'ready';
  }
  trigger():PlayerAction{
    const state=this.triggerState;
    if(state==='finished')return 'ignored';
    if(state==='wait')return 'ignored'; // Early clicks never draw or consume ammunition.
    if(state==='holstered'){this.playerDrawAt=this.elapsed;this.reactionTime=Math.max(0,this.elapsed-this.signalAt);return 'draw'}
    if(state!=='ready')return state;
    this.playerAmmo--;this.playerShots++;this.playerNextShot=this.elapsed+PLAYER_SHOT_INTERVAL;return 'shot';
  }
  reload(){if(this.phase==='signal'&&this.playerDrawn&&this.playerAmmo<6&&!this.reloadUntil){this.reloadUntil=this.elapsed+2.2;return true}return false}
  finish(won:boolean,reason:string){if(this.terminal)return;this.phase=won?'won':'lost';this.resultReason=reason;this.finishedAt=this.elapsed}

  get resultVisible(){return this.terminal&&this.elapsed-this.finishedAt>=RESULT_DELAY-1e-8}
  get aftermathRemaining(){return Math.max(0,RESULT_DELAY-(this.elapsed-this.finishedAt))}
  get sinceSignal(){return this.elapsed-this.signalAt}
  get drawProgress(){return Math.max(0,Math.min(1,(this.elapsed-this.playerDrawAt)/DRAW_SECONDS))}
  get cooldownProgress(){return Math.max(0,Math.min(1,1-(this.reloadUntil>this.elapsed?(this.reloadUntil-this.elapsed)/2.2:(this.playerNextShot-this.elapsed)/PLAYER_SHOT_INTERVAL)))}
}
