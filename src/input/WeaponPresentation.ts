import {Euler,Quaternion,Vector3} from 'three';
export const MUZZLE_LOCAL=new Vector3(0,.025,.178);
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const smoothstep=(v:number)=>{const t=clamp(v);return t*t*(3-2*t)};
/** Recoil is measured on simulation time, so pause/slow motion keep sight and barrel synchronized. */
export function recoilAt(age:number){
 if(age<0||age>.32)return 0;
 return age<.025?age/.025:Math.exp(-(age-.025)*17)*(1-smoothstep((age-.22)/.10));
}
export function weaponPose(camera:Vector3,cameraRotation:Quaternion,progress:number,ads:number,recoil:number){
 const draw=smoothstep(progress),zoom=clamp(ads)*draw;
 const local=new Vector3(.19*(1-zoom),-.2+.08*zoom-(1-draw)*.48,-.43-.25*zoom+recoil*.035);
 const rotation=cameraRotation.clone().multiply(new Quaternion().setFromEuler(new Euler(recoil*.19+(1-draw)*.85,Math.PI,(1-draw)*-.65)));
 const position=local.applyQuaternion(cameraRotation).add(camera);
 const muzzle=MUZZLE_LOCAL.clone().applyQuaternion(rotation).add(position);
 return {position,rotation,muzzle};
}
