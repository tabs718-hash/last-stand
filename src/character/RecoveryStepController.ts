import {Quaternion,Vector3} from 'three';
import type {Muscle,Part} from './CharacterTypes';
import type {BalanceController} from './BalanceController';
import {RECOVERY} from '../config/behaviour';
import {solveLegTargets,type LegTargets} from './LegIK';
export class RecoveryStepController {
  enabled=true;
  phase:'idle'|'unloading'|'swing'|'landing'|'cooldown'='idle';
  side:'Left'|'Right'='Right';
  elapsed=0;
  cooldown=0;
  start=new Vector3();
  landing=new Vector3();
  target=new Vector3();
  footRotation=new Quaternion();
  targets:LegTargets|null=null;
  lifted=false;
  completed=0;
  attempts=0;
  failed=0;
  maxClearance=0;
  displacement=0;
  private startPosition=new Vector3();
  private candidateTime=0;
  private leg!:Muscle[];
  private stance=new Map<Muscle,Quaternion>();
  private planted:Vector3[]=[];
  constructor(private parts:Part[],private muscles:Muscle[],private balance:BalanceController){}
  private foot(side=this.side){return this.parts.find(p=>p.name===side+' foot')!}
  get moving(){return this.phase==='unloading'||this.phase==='swing'||this.phase==='landing'}
  update(dt:number,allowed:boolean){
    this.cooldown=Math.max(0,this.cooldown-dt);
    if(!allowed){if(this.moving)this.failed++;this.phase='idle';this.targets=null;this.balance.stepSupport=null;this.stance.clear();this.candidateTime=0;return}
    if(!this.enabled){if(this.moving)this.failed++;this.phase='idle';this.targets=null;this.balance.stepSupport=null;this.candidateTime=0;if(this.stance.size)this.updateStanceReference();return}
    if(this.phase==='cooldown'&&this.cooldown<=0)this.phase='idle';
    if(this.stance.size&&!this.moving)this.updateStanceReference();
    if(this.phase==='idle'){
      const speed=this.balance.velocity.clone().setY(0).length();
      const feet=this.parts.filter(p=>p.name.endsWith('foot'));
      const needed=this.balance.support.feet.length===2&&feet.every(p=>p.functionality>.45)&&this.balance.margin<RECOVERY.stepMargin&&speed>RECOVERY.stepSpeed&&Math.abs(this.balance.error.x)>.14;
      this.candidateTime=needed?this.candidateTime+dt:0;
      if(this.candidateTime>.01){
        const supports=this.balance.support.feet;
        const left=supports.find(f=>f.part.name==='Left foot')!,right=supports.find(f=>f.part.name==='Right foot')!;
        // Keep the loaded leg as the stance leg; moving it would remove the current support.
        this.side=Math.max(left.load,right.load)>Math.min(left.load,right.load)*1.2?(left.load<right.load?'Left':'Right'):(this.balance.error.x>=0?'Right':'Left');
        this.candidateTime=0;this.begin();
      }
    }
    if(!this.moving)return;
    this.elapsed+=dt;
    const foot=this.foot();
    const contact=this.balance.support.feet.some(f=>f.part===foot);
    const position=new Vector3().copy(foot.body.translation());
    const rotation=new Quaternion().copy(foot.body.rotation());
    let bottom=Infinity;
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])bottom=Math.min(bottom,new Vector3(x*foot.size[0]/2,y*foot.size[1]/2,z*foot.size[2]/2).applyQuaternion(rotation).add(position).y);
    this.maxClearance=Math.max(this.maxClearance,bottom);
    if(!contact&&bottom>.018)this.lifted=true;
    const progress=Math.max(0,Math.min(1,(this.elapsed-.01)/RECOVERY.stepDuration));
    this.phase=this.elapsed<.01?'unloading':progress<1?'swing':'landing';
    this.balance.stepSupport=this.parts.find(p=>p.name===(this.side==='Right'?'Left':'Right')+' foot')!;
    const blend=progress*progress*(3-2*progress);
    this.target.lerpVectors(this.start,this.landing,blend);this.target.y+=Math.sin(Math.PI*progress)*RECOVERY.stepHeight;
    this.targets=solveLegTargets(this.leg[0],this.leg[1],this.leg[2],this.target,this.footRotation);
    this.displacement=position.clone().setY(0).distanceTo(this.startPosition);
    if(progress>.7&&this.lifted&&contact&&this.displacement>.045){this.finish(true)}
    else if(this.elapsed>RECOVERY.stepDuration+.55)this.finish(false);
  }
  private begin(){
    this.elapsed=0;this.lifted=false;this.maxClearance=0;this.displacement=0;this.attempts++;
    this.start.copy(this.foot().body.translation());this.startPosition.copy(this.start).setY(0);
    const side=this.side==='Right'?1:-1;
    this.landing.set(this.balance.capturePoint.x+this.balance.velocity.x*.4+side*.10,.075,this.balance.capturePoint.z+this.balance.velocity.z*.4+.055);
    const offset=this.landing.clone().sub(this.start).setY(0).clampLength(0,RECOVERY.stepReach);
    this.landing.copy(this.start).add(offset).setY(.075);
    const other=this.foot(this.side==='Right'?'Left':'Right').body.translation();
    if(side>0)this.landing.x=Math.max(this.landing.x,other.x+.22);else this.landing.x=Math.min(this.landing.x,other.x-.22);
    this.footRotation.identity();
    this.leg=['thigh','shin','foot'].map(name=>this.muscles.find(m=>m.b.name===this.side+' '+name)!);
    this.phase='unloading';
  }
  private finish(success:boolean){
    if(success){this.completed++;this.adoptStance()}else this.failed++;
    this.phase='cooldown';this.cooldown=RECOVERY.stepCooldown;this.targets=null;this.balance.stepSupport=null;
  }
  private adoptStance(){
    this.planted=[new Vector3().copy(this.foot('Left').body.translation()).setY(.075),new Vector3().copy(this.foot('Right').body.translation()).setY(.075)];
    this.updateStanceReference();
  }
  private updateStanceReference(){
    const [left,right]=this.planted;
    const position=left.clone().add(right).multiplyScalar(.5);position.z-=.055;
    // A virtual reference posture, not a constraint on the actual pelvis.
    position.x-=Math.max(-.13,Math.min(.13,this.balance.error.x*.85));
    position.z-=Math.max(-.07,Math.min(.07,this.balance.velocity.z*.2));
    const leftReach=Math.hypot(left.x-(position.x-.17),left.z-(position.z+.055));
    const rightReach=Math.hypot(right.x-(position.x+.17),right.z-(position.z+.055));
    const reach=Math.max(leftReach,rightReach);
    position.y=.23+Math.sqrt(Math.max(.30,.75*.75-reach*reach))-.002;
    const rotation=new Quaternion();
    for(const side of ['Left','Right'] as const){
      const leg=['thigh','shin','foot'].map(name=>this.muscles.find(m=>m.b.name===side+' '+name)!);
      const poses=solveLegTargets(leg[0],leg[1],leg[2],side==='Left'?left:right,new Quaternion(),{position,rotation});
      this.stance.set(leg[0],poses.hip);this.stance.set(leg[1],poses.knee);this.stance.set(leg[2],poses.ankle);
    }
  }
  pose(muscle:Muscle){
    const stance=this.stance.get(muscle);
    if(stance)muscle.desired.premultiply(stance);

    if((!this.moving&&this.phase!=='cooldown')||!this.targets)return;
    if(this.leg.includes(muscle))muscle.targetRate=4;
    if(muscle===this.leg[0])muscle.desired.copy(this.targets.hip);
    if(muscle===this.leg[1])muscle.desired.copy(this.targets.knee);
    if(muscle===this.leg[2])muscle.desired.copy(this.targets.ankle);
  }
}
