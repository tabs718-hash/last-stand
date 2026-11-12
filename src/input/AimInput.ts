import {Euler,Quaternion,Vector3} from 'three';
import {weaponPose} from './WeaponPresentation';
const clamp=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
/** Both click snapshots and rendered gun use these same world transforms. */
export class AimInput {
  origin=new Vector3(0,1.65,12);
  yaw=0;pitch=0;zoom=false;ads=0;
  advance(dt:number,canAim=true){const target=this.zoom&&canAim?1:0;this.ads+=(target-this.ads)*(1-Math.exp(-Math.min(.05,Math.max(0,dt))*15))}
  moveRelative(x:number,y:number){const sensitivity=.0018*(1-this.ads*.45);this.yaw=clamp(this.yaw-x*sensitivity,-.7,.7);this.pitch=clamp(this.pitch-y*sensitivity,-1.2,.55)}
  moveAbsolute(x:number,y:number,width:number,height:number){
    if(width<=0||height<=0)return;
    this.yaw=clamp(-(x-width/2)/width*.8,-.7,.7);
    this.pitch=clamp(-(y-height/2)/height*.6,-1.2,.55);
  }
  snapshot(recoil=0,drawProgress=1){
    const camera=this.origin.clone();
    const rotation=new Quaternion().setFromEuler(new Euler(this.pitch+recoil*.013,this.yaw,0,'YXZ'));
    const weapon=weaponPose(camera,rotation,drawProgress,this.ads,recoil);
    return {camera,rotation,direction:new Vector3(0,0,-1).applyQuaternion(rotation),muzzle:weapon.muzzle,weapon};
  }
  release(){this.zoom=false}
}
