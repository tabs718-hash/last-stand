import {Euler,Quaternion,Vector3} from 'three';
import type {Part,Muscle} from './CharacterTypes';
import {GRAVITY} from '../config/ragdoll';
import {RECOVERY} from '../config/behaviour';
import {SupportDetector} from './SupportDetector';

export class BalanceController {
  com=new Vector3();
  velocity=new Vector3();
  capturePoint=new Vector3();
  error=new Vector3();
  margin=0;
  enabled=true;
  crouch=0;
  supportAsymmetry=0;
  stepSupport:Part|null=null;
  targetCenter=new Vector3();
  requestedTorque=new Vector3();
  state:'settling'|'balanced'|'recovering'|'falling'='settling';
  constructor(private parts:Part[], public support:SupportDetector,private carried:()=>Part[]=()=>[]){}

  update(dt:number){
    this.support.update(dt);
    this.com.set(0,0,0);this.velocity.set(0,0,0);
    let mass=0;
    for(const p of [...this.parts,...this.carried()]){
      this.com.addScaledVector(new Vector3().copy(p.body.worldCom()),p.mass);
      this.velocity.addScaledVector(new Vector3().copy(p.body.linvel()),p.mass);
      mass+=p.mass;
    }
    this.com.divideScalar(mass);this.velocity.divideScalar(mass);
    this.capturePoint.copy(this.com).addScaledVector(this.velocity,Math.sqrt(Math.max(.1,this.com.y)/GRAVITY));
    this.capturePoint.y=.012;
    this.margin=this.support.margin(this.capturePoint);
    this.targetCenter.copy(this.support.center);
    if(this.stepSupport)this.targetCenter.lerp(new Vector3().copy(this.stepSupport.body.translation()),.35);
    this.error.copy(this.capturePoint).sub(this.targetCenter);this.error.y=0;
    const abilities=this.parts.filter(p=>p.name.endsWith('foot')).map(p=>p.functionality);
    this.supportAsymmetry=Math.abs(abilities[0]-abilities[1]);
    const speed=this.velocity.clone().setY(0).length();
    const desiredCrouch=this.com.y>.7?Math.min(RECOVERY.crouchLimit,Math.max(0,speed-.08)*.22):0;
    this.crouch+=(desiredCrouch-this.crouch)*(1-Math.exp(-dt*8));
    const pelvis=this.parts.find(p=>p.name==='Pelvis')!.body;
    const up=new Vector3(0,1,0).applyQuaternion(new Quaternion().copy(pelvis.rotation()));
    const omega=pelvis.angvel();
    this.requestedTorque.copy(up).cross(new Vector3(0,1,0)).multiplyScalar(240)
      .add(new Vector3(-omega.x,0,-omega.z).multiplyScalar(35))
      .add(new Vector3(-this.error.z,0,this.error.x).multiplyScalar(80)).clampLength(0,140);
    this.state=this.com.y<.55?'falling':!this.support.feet.length?'settling':this.margin<.06||speed>.18||this.supportAsymmetry>.2?'recovering':'balanced';
  }

  pose(muscle:Muscle){
    muscle.desired.identity();muscle.balanceTorque.set(0,0,0);
    if(!this.enabled || this.state==='falling' || !this.support.feet.length) return;
    if(/thigh|shin|foot/.test(muscle.b.name)&&this.state==='recovering'){
      const side=muscle.b.name.startsWith('Left')?'Left':'Right';
      const foot=this.support.feet.find(f=>f.part.name.startsWith(side));
      const total=this.support.feet.reduce((sum,f)=>sum+f.load*f.ability*f.ability,0);
      if(foot&&total>0){
        muscle.balanceTorque.copy(this.requestedTorque).multiplyScalar(-foot.load*foot.ability*foot.ability/total);
        if(muscle.hinge){const axis=new Vector3(1,0,0).applyQuaternion(new Quaternion().copy(muscle.a.body.rotation()));const scalar=muscle.balanceTorque.dot(axis);muscle.balanceTorque.copy(axis).multiplyScalar(scalar)}
      }
    }
    const x=Math.max(-.08,Math.min(.08,this.error.z*.12));
    const gain=(this.stepSupport?1:.12)+this.supportAsymmetry*RECOVERY.weightShiftGain;
    const z=Math.max(-.16,Math.min(.16,-this.error.x*gain));
    if(muscle.b.name.endsWith('foot')) muscle.desired.setFromEuler(new Euler(x-this.crouch*.5,0,z));
    // The hip target shifts the trunk over the surviving support without moving bodies directly.
    if(muscle.b.name.endsWith('shin'))muscle.desired.setFromAxisAngle(new Vector3(1,0,0),this.crouch);
    if(muscle.b.name.endsWith('thigh')) muscle.desired.setFromEuler(new Euler(x*.35-this.crouch*.5,0,z*.5));
  }
}
