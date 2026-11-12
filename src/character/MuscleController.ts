import {Quaternion,Vector3} from 'three';
import type {Muscle,Part} from './CharacterTypes';

export class MuscleController {
  constructor(public muscles:Muscle[],private carried:()=>Part[]=()=>[]){}
  private gravityCompensation(muscle:Muscle){
    const parts:Part[]=[];
    const visit=(part:Part)=>{parts.push(part);for(const child of this.muscles.filter(m=>m.a===part))visit(child.b)};
    visit(muscle.b);
    if(parts.some(p=>p.name==='Right hand'))parts.push(...this.carried());
    const anchor=new Vector3().copy(muscle.joint.anchor1()).applyQuaternion(new Quaternion().copy(muscle.a.body.rotation())).add(muscle.a.body.translation());
    const torque=new Vector3();
    for(const p of parts)torque.sub(new Vector3().copy(p.body.worldCom()).sub(anchor).cross(new Vector3(0,-9.81*p.mass,0)));
    return torque;
  }
  update(dt:number,activation:number){
    for(const m of this.muscles){
      const profile=m.profile;
      m.target.slerp(m.desired,1-Math.exp(-profile.targetResponseSpeed*m.targetRate*dt));
      const qa=new Quaternion().copy(m.a.body.rotation());
      const current=qa.clone().invert().multiply(new Quaternion().copy(m.b.body.rotation()));
      const error=m.target.clone().multiply(current.invert());
      if(error.w<0) error.set(-error.x,-error.y,-error.z,-error.w);
      const sin=Math.hypot(error.x,error.y,error.z);
      m.angleError=2*Math.atan2(sin,error.w);
      const e=new Vector3(error.x,error.y,error.z).multiplyScalar(sin>1e-8?m.angleError/sin:0).applyQuaternion(qa);
      const av=m.a.body.angvel(),bv=m.b.body.angvel();
      const functional=profile.injuryMultiplier*Math.min(m.a.functionality,m.b.functionality);
      const strength=activation*profile.activation*functional*m.stateActivation;
      m.limit=profile.maxTorque*strength;
      m.torque.copy(e).multiplyScalar(profile.stiffness*strength)
        .add(new Vector3(av.x-bv.x,av.y-bv.y,av.z-bv.z).multiplyScalar(profile.damping*strength))
;
      if(/upper arm|forearm|hand/.test(m.b.name))m.torque.addScaledVector(this.gravityCompensation(m),strength);
      const balance=m.balanceTorque.clone().multiplyScalar(strength);
      if(balance.lengthSq()>1){
        const direction=balance.clone().normalize(),opposing=m.torque.dot(direction),minimum=-balance.length()*.25;
        if(opposing<minimum)m.torque.addScaledVector(direction,minimum-opposing);
      }
      m.torque.add(balance);
      m.torque.clampLength(0,m.limit);
      // Equal and opposite torques conserve angular momentum in free flight.
      m.b.body.addTorque(m.torque,true);
      m.a.body.addTorque(m.torque.clone().negate(),true);
    }
  }
}
