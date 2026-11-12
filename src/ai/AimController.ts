import {Quaternion,Vector3} from 'three';
import type {Rig} from '../character/Rig';
export class AimController {
  update(rig:Rig,dt:number,targetPoint=new Vector3(0,1.15,12)){
    const body=rig.grip.weapon;
    const forward=new Vector3(0,0,1).applyQuaternion(new Quaternion().copy(body.rotation()));
    const target=targetPoint.clone().sub(body.translation()).normalize();
    const pitchError=Math.atan2(target.y,target.z)-Math.atan2(forward.y,forward.z);
    const yawError=Math.atan2(target.x,target.z)-Math.atan2(forward.x,forward.z);
    rig.aimPitch=Math.max(-.5,Math.min(.25,rig.aimPitch-pitchError*dt*1.2));
    rig.aimYaw=Math.max(-.25,Math.min(.25,rig.aimYaw+yawError*dt*1.2));
  }
}
