import {Vector3,Quaternion} from 'three';
import type {Rig} from '../character/Rig';
import {DuelRules} from '../combat/DuelRules';
import {SeededRandom} from '../core/SeededRandom';
import {AimController} from './AimController';
import {FIXED_DT} from '../config/ragdoll';
export class OpponentAI {
  aim=new AimController();
  state='waiting';
  ammo=6;
  nextShot=3;
  shots=0;
  reloadUntil=0;
  constructor(private random:SeededRandom){}
  update(rig:Rig,rules:DuelRules,fire:(origin:Vector3,direction:Vector3)=>void,targetPoint=new Vector3(0,1.15,12)){
    if(!rig.grip.secured){this.state='disarmed';rig.aiming=false;return}
    if(rig.injuries.consciousness<.1){this.state='unconscious';rig.aiming=false;return}
    if(rules.phase!=='signal'){this.state=rules.terminal?'finished':'waiting';rig.aiming=rules.terminal&&rig.grip.held;return}
    rig.behaviour.aimTarget.copy(targetPoint);
    const time=rules.sinceSignal;
    if(time<.25){this.state='reaction';return}
    rig.draw.request(rig.time);
    rig.aiming=rig.grip.held;
    if(rig.draw.active&&!rig.draw.ready){this.state=rig.draw.phase;return}
    if(!rig.behaviour.grounded){if(time<1.2){rig.aimPitch=0;rig.aimYaw=-.025}else this.aim.update(rig,FIXED_DT,targetPoint);}
    if(time<1.01){this.state='drawing';return}
    this.state=rig.behaviour.grounded?'ground aiming':'aiming';
    if(this.ammo<=0){if(!this.reloadUntil)this.reloadUntil=time+2.2;if(time<this.reloadUntil){this.state='reloading';return}this.ammo=6;this.reloadUntil=0;this.nextShot=time+.15}
    if(time<this.nextShot){if(this.shots>0)this.state='recovering';return}
    const gun=rig.grip.weapon,rotation=new Quaternion().copy(gun.rotation());
    const forward=new Vector3(0,0,1).applyQuaternion(rotation);
    const muzzle=new Vector3().copy(gun.translation()).addScaledVector(forward,.2);
    const target=targetPoint.clone().sub(muzzle).normalize();
    if(forward.dot(target)<.99){this.state=rig.behaviour.grounded?'ground seeking aim':'seeking aim';return}
    const impairment=1-rig.part('Right hand').functionality*rig.part('Right forearm').functionality;
    const shotDirection=forward.clone();
    shotDirection.x+=(this.random.next()-.5)*(.008+impairment*.25);
    shotDirection.y+=(this.random.next()-.5)*(.008+impairment*.25);
    fire(muzzle,shotDirection.normalize());
    gun.applyImpulseAtPoint(forward.multiplyScalar(-.55),muzzle,true);
    this.nextShot=time+1.3;this.ammo--;this.shots++;this.state='firing';
  }
}
