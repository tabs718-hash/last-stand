import {Euler,Quaternion,Vector3} from 'three';
import type {Part,Muscle} from './CharacterTypes';
import type {GripController} from '../combat/GripController';
const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t)};
/** Changes bounded muscle targets only. Grasp swaps constraints at the current physical pose. */
export class HolsterDrawController {
 requestedAt=Infinity;graspedAt=Infinity;phase='holstered';progress=0;
 private blendNormal=0;
 private targets=new Map<string,Quaternion>();
 constructor(private parts:Part[],private grip:GripController){}
 request(now:number){if(this.grip.holstered&&this.requestedAt===Infinity)this.requestedAt=now}
 get active(){return !!this.grip.holster}
 get ready(){return !this.active||this.phase==='ready'}
 private part(name:string){return this.parts.find(p=>p.name===name)!}
 update(now:number,enabled:boolean){
  this.targets.clear();this.blendNormal=0;if(!this.active||!enabled||!this.grip.secured)return;
  if(!Number.isFinite(this.requestedAt)){
   this.phase='holstered';this.targets.set('Right upper arm',new Quaternion().setFromEuler(new Euler(.1,0,.16)));this.targets.set('Right forearm',new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-.1));this.targets.set('Right hand',new Quaternion());return;
  }
  if(this.grip.holstered){
   this.phase='reaching';this.progress=Math.min(.3,(now-this.requestedAt)/2.75);
   this.reach(new Vector3().copy(this.grip.weapon.translation()),new Quaternion().copy(this.grip.weapon.rotation()));
   if(this.grip.grasp()){this.graspedAt=now;this.phase='extracting'}
   return;
  }
  const age=now-this.graspedAt,duration=Math.max(this.requestedAt+2.75,this.graspedAt+2.2)-this.graspedAt;
  if(age>=duration){this.phase='ready';this.progress=1;return}
  const pelvis=this.part('Pelvis').body,p=new Vector3().copy(pelvis.translation()),q=new Quaternion().copy(pelvis.rotation());
  const extract=ease(age/(duration*.30)),raise=ease((age-duration*.30)/(duration*.50));
  const local=new Vector3(.31,-.085+extract*.31,.015).lerp(new Vector3(.33,.38,.46),raise);
  const gunQ=q.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2*(1-raise)));
  this.reach(local.applyQuaternion(q).add(p),gunQ);
  this.phase=age<duration*.30?'extracting':'raising';this.progress=.3+.7*Math.min(1,age/duration);
  if(age>duration*.8)this.blendNormal=ease((age-duration*.8)/(duration*.2));
 }
 private reach(gun:Vector3,gunQ:Quaternion){
  const handQ=this.grip.holstered?new Quaternion().copy(this.part('Chest').body.rotation()).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-.25)):gunQ.clone().multiply(this.grip.handFrame.clone().invert());
  const hand=gun.clone().add(new Vector3(0,0,-.09).applyQuaternion(gunQ)).sub(new Vector3(0,-.025,.04).applyQuaternion(handQ));
  const wrist=hand.add(new Vector3(0,.06,0).applyQuaternion(handQ));
  const chest=this.part('Chest').body,chestQ=new Quaternion().copy(chest.rotation());
  const shoulder=new Vector3(.26,.08,0).applyQuaternion(chestQ).add(chest.translation());
  const local=wrist.clone().sub(shoulder).applyQuaternion(chestQ.clone().invert());
  const axis=new Vector3(0,local.y,local.z),distance=Math.min(.55,Math.max(.07,axis.length()));axis.normalize();
  const l1=.30,l2=.26,a=(l1*l1-l2*l2+distance*distance)/(2*distance);
  const pole=new Vector3(0,axis.z,-axis.y).negate(); // elbow behind, preserving the X hinge plane
  if(pole.z>0)pole.negate();
  const elbow=axis.clone().multiplyScalar(a).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-a*a)));
  const fore=local.clone().sub(elbow);
  const upperQ=chestQ.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.atan2(-elbow.z,-elbow.y)));
  const foreQ=chestQ.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.atan2(-fore.z,-fore.y)));
  const actualGrip=new Vector3(0,-.025,.04).applyQuaternion(new Quaternion().copy(this.part('Right hand').body.rotation())).add(this.part('Right hand').body.translation());
  const gripTarget=gun.clone().add(new Vector3(0,0,-.09).applyQuaternion(gunQ));
  const xError=actualGrip.sub(gripTarget).applyQuaternion(chestQ.clone().invert()).x;
  const relativeUpper=chestQ.invert().multiply(upperQ);const angles=new Euler().setFromQuaternion(relativeUpper);angles.z-=Math.max(-.5,Math.min(.5,xError*4));
  this.targets.set('Right upper arm',new Quaternion().setFromEuler(angles));
  this.targets.set('Right forearm',upperQ.clone().invert().multiply(foreQ));
  this.targets.set('Right hand',foreQ.clone().invert().multiply(handQ));
 }
 pose(m:Muscle){const q=this.targets.get(m.b.name);if(q){m.desired.copy(q.clone().slerp(m.desired,this.blendNormal));m.targetRate=1.8}}
}
