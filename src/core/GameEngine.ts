import {DEFAULT_DUEL_DISTANCE,validateDuelDistance} from '../config/duel';
import R from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {Rig,DT} from '../character/Rig';
import type {InitialPose} from '../config/behaviour';
import {PlayerBody} from '../combat/PlayerBody';
import {isArm} from '../combat/VitalState';
import {PlayerEquipment} from '../combat/PlayerEquipment';
import {DuelRules} from '../combat/DuelRules';
import {OpponentAI} from '../ai/OpponentAI';
import {SeededRandom} from './SeededRandom';
import {WEAPON_PROFILES} from '../combat/WeaponProfiles';
import {SHOT_ENERGY,type ShotRecord} from '../combat/BallisticsSystem';
import {EventBus} from './EventBus';
import type {DuelPhase,PlayerAction} from '../combat/DuelRules';
export class GameEngine {
  readonly physicsVersion=R.version();
  private disposed=false;
  rig:Rig;
  rules:DuelRules;
  ai:OpponentAI;
  mode:'lab'|'duel'='lab';
  resultAt=0;
  playerBody:PlayerBody;
  get playerHealth(){return this.playerBody.vitals.health}
  playerHits=0;
  lastPlayerAction:PlayerAction='ignored';
  playerActionAt=-10;
  playerShotAt=-10;
  aiShotAt=-10;
  playerCollider:R.Collider;
  playerEquipment:PlayerEquipment|null=null;
  commandLog:Record<string,unknown>[]=[];
  events=new EventBus<{phaseChanged:{from:DuelPhase;to:DuelPhase;time:number};shot:ShotRecord;playerAction:{action:PlayerAction;time:number}}>();
  private inputEnabled=true;
  private commands:{kind:'start'|'trigger';run:()=>void}[]=[];
  constructor(public seed=1,public initialPose:InitialPose='standing',mode:'lab'|'duel'='duel',readonly duelDistance:number=DEFAULT_DUEL_DISTANCE){
    validateDuelDistance(duelDistance);
    this.mode=mode;
    this.rig=new Rig(initialPose,true);if(mode==='duel')this.rig.energyMode='LOW';
    this.rig.ballistics.events.on('shot',shot=>this.events.emit('shot',shot));
    this.playerBody=new PlayerBody(this.rig.world,this.rig.registry,this.duelDistance);
    if(mode==='duel')this.playerEquipment=new PlayerEquipment(this.rig.world,this.playerBody.body);
    this.rules=new DuelRules(seed);
    this.ai=new OpponentAI(new SeededRandom(seed^0x13579));
    this.playerCollider=this.playerBody.hitboxes[1];
    if(this.playerEquipment)this.rig.registry.add({id:'player weapon',actor:'player',collider:this.playerEquipment.gun.collider(0),body:this.playerEquipment.gun,zone:'weapon',size:[.08,.15,.34],resistance:18000,surfaceLoss:2,coreResistance:0});
  }
  setInputEnabled(enabled:boolean){
    this.inputEnabled=enabled;
    if(!enabled)this.commands=this.commands.filter(command=>command.kind!=='trigger');
  }
  get acceptsInput(){return !this.disposed&&this.inputEnabled&&this.mode==='duel'&&(this.rules.phase==='signal'||this.rules.phase==='waiting')}
  start(skipWait=false){if(this.disposed)return;this.commands.push({kind:'start',run:()=>{this.mode='duel';this.commandLog.push({step:this.rig.steps,type:'start',skipWait});this.rules.start(skipWait)}})}
  trigger(camera:Vector3,direction:Vector3,muzzle:Vector3){
    if(!this.acceptsInput)return false;
    const origin=camera.clone(),aim=direction.clone(),barrel=muzzle.clone();
    this.commands.push({kind:'trigger',run:()=>{
      this.commandLog.push({step:this.rig.steps,type:'trigger',camera:origin.toArray(),direction:aim.toArray(),muzzle:barrel.toArray()});
      const early=this.rules.phase==='waiting';
      const action=early?'wait':this.playerEquipment?.dropped?'disarmed':this.rules.reloadUntil>this.rules.elapsed?'reloading':this.rules.triggerState==='ready'&&this.playerEquipment&&!this.playerEquipment.ready?'drawing':this.rules.trigger();
      this.lastPlayerAction=action;this.playerActionAt=this.rig.time;
      this.events.emit('playerAction',{action,time:this.rig.time});
      if(action==='shot'){
        const shot=this.rig.ballistics.fromCamera(origin,aim,barrel,SHOT_ENERGY[this.rig.energyMode],this.rig.time,new Set([...this.rig.registry.entries.values()].filter(e=>e.actor==='player').map(e=>e.id)),WEAPON_PROFILES[this.rig.energyMode].penetration);
        this.rig.damage.resolve(shot.hits);this.playerShotAt=this.rig.time;
        if(shot.hits.some(h=>h.zone!=='environment'))this.playerHits++;
      }
    }});
    return true;
  }
  step(){
    if(this.disposed)return;
    const previousPhase=this.rules.phase;
    for(const command of this.commands.splice(0))command.run();
    if(this.mode==='duel'){
      this.rules.update(DT);
      this.checkResult();
      this.ai.update(this.rig,this.rules,(origin,direction)=>{
        const shot=this.rig.ballistics.shoot(origin,direction,220,this.rig.time,new Set(), 'stop');
        this.rig.damage.resolve(shot.hits);this.aiShotAt=this.rig.time;
        const hit=this.playerBody.resolve(shot.hits);
        if(hit&&this.playerEquipment&&(!this.playerBody.vitals.alive||shot.hits.some(h=>h.entry.actor==='player'&&h.depositedEnergy>0&&(h.zone==='weapon'||isArm(h.zone)&&h.colliderId.includes('Right'))))&&this.playerEquipment.held)this.playerEquipment.drop();
        if(!this.playerBody.vitals.alive)this.rules.finish(false,this.playerBody.vitals.deathReason==='head'?'Смертельное попадание в голову.':'Два попадания в ваш корпус.');
      },this.playerBody.target());
    }
    this.playerBody.update(DT);
    if(this.playerEquipment){this.playerEquipment.snapshotPrevious();this.playerEquipment.update(this.rules.drawProgress)}
    this.rig.step();
    if(this.mode==='duel')this.checkResult();
    if(previousPhase!==this.rules.phase){if(this.rules.terminal)this.resultAt=this.rules.elapsed;this.events.emit('phaseChanged',{from:previousPhase,to:this.rules.phase,time:this.rig.time})}
  }
  reload(){if(this.acceptsInput&&this.playerEquipment?.held)return this.rules.reload();return false}
  private checkResult(){
    if(!['signal','waiting'].includes(this.rules.phase))return;
    if(!this.rig.injuries.alive)this.rules.finish(true,this.rig.injuries.vitals.deathReason==='head'?'Смертельное попадание в голову противника.':'Два попадания в корпус противника.');

  }
  dispose(){if(this.disposed)return;this.disposed=true;this.inputEnabled=false;this.commands.length=0;this.rig.ballistics.events.clear();this.events.clear();this.rig.dispose()}
}
