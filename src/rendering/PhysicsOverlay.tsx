import {useFrame} from '@react-three/fiber';
import {useEffect,useMemo,useRef} from 'react';
import {BufferGeometry,Float32BufferAttribute,Group,LineSegments,LineBasicMaterial,Vector3} from 'three';
import type {Rig} from '../character/Rig';
import {RECOVERY} from '../config/behaviour';
import {targetPoses} from '../character/TargetPose';
import type {DebugSettings} from './DebugSettings';
export function PhysicsOverlay({rig,settings}:{rig:Rig;settings:DebugSettings}){
 const lines=useMemo(()=>new LineSegments(new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array(600),3)),new LineBasicMaterial({color:'#b9e2a0',depthTest:false,transparent:true,opacity:.8})),[]);
 const planned=useMemo(()=>new LineSegments(new BufferGeometry().setAttribute('position',new Float32BufferAttribute(new Float32Array(96),3)),new LineBasicMaterial({color:'#c38be5',depthTest:false,transparent:true,opacity:.65})),[]);
 const landing=useRef<Group>(null!);
 const com=useRef<Group>(null!),capture=useRef<Group>(null!),contacts=useRef<Group>(null!),ghost=useRef<Group>(null!);
 useEffect(()=>()=>{lines.geometry.dispose();(lines.material as LineBasicMaterial).dispose();planned.geometry.dispose();(planned.material as LineBasicMaterial).dispose()},[lines,planned]);
 useFrame(()=>{
  const step=rig.recoveryStep;
  const showStep=settings.support&&(step.moving||step.phase==='cooldown');
  landing.current.visible=showStep;planned.visible=showStep;
  landing.current.position.copy(step.landing).setY(.015);
  if(showStep){
    const positions=planned.geometry.getAttribute('position');
    for(let i=0;i<16;i++)for(let end=0;end<2;end++){
      const p=(i+end)/16,blend=p*p*(3-2*p);
      const point=step.start.clone().lerp(step.landing,blend);point.y+=Math.sin(Math.PI*p)*RECOVERY.stepHeight;
      positions.setXYZ(i*2+end,point.x,point.y,point.z);
    }
    positions.needsUpdate=true;planned.geometry.setDrawRange(0,32);planned.frustumCulled=false;
  }
  com.current.visible=settings.centerOfMass;capture.current.visible=settings.support;
  contacts.current.visible=settings.support;ghost.current.visible=settings.targets;
  com.current.position.copy(rig.com);capture.current.position.copy(rig.balance.capturePoint);
  contacts.current.children.forEach((mesh,i)=>{const p=rig.balance.support.points[i];mesh.visible=!!p;if(p)mesh.position.copy(p).setY(.018)});
  const segments:Vector3[]=[];
  const hull=rig.balance.support.hull;
  if(settings.support)for(let i=0;i<hull.length;i++)segments.push(hull[i].clone().setY(.015),hull[(i+1)%hull.length].clone().setY(.015));
  if(settings.centerOfMass)segments.push(rig.com.clone(),rig.com.clone().setY(.015));
  if(settings.joints)for(const m of rig.muscles){
    const anchor=new Vector3().copy(m.joint.anchor1()).applyQuaternion(m.a.previousQ).add(m.a.previous);
    segments.push(m.a.previous.clone(),anchor,anchor.clone(),m.b.previous.clone());
  }
  const position=lines.geometry.getAttribute('position');segments.forEach((p,i)=>position.setXYZ(i,p.x,p.y,p.z));position.needsUpdate=true;lines.geometry.setDrawRange(0,segments.length);lines.frustumCulled=false;
  if(settings.targets){
    const poses=targetPoses(rig.parts[0],rig.muscles);
    ghost.current.children.forEach((mesh,i)=>{const pose=poses.get(rig.parts[i].name)!;mesh.position.copy(pose.position);mesh.quaternion.copy(pose.rotation)});
  }
 });
 return <><primitive object={planned}/><group ref={landing}><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.055,.065,24]}/><meshBasicMaterial color="#c38be5" depthTest={false}/></mesh></group><primitive object={lines}/><group ref={ghost}>{rig.parts.map(p=><mesh key={p.name} renderOrder={9}><boxGeometry args={p.size}/><meshBasicMaterial color="#edb15d" wireframe transparent opacity={.55} depthTest={false}/></mesh>)}</group><group ref={com}><mesh renderOrder={10}><sphereGeometry args={[.025,12,8]}/><meshBasicMaterial color="#f1c267" depthTest={false}/></mesh></group><group ref={capture}><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.035,.045,24]}/><meshBasicMaterial color="#f19151" depthTest={false}/></mesh></group><group ref={contacts}>{Array.from({length:16},(_,i)=><mesh key={i} renderOrder={10}><sphereGeometry args={[.014,8,6]}/><meshBasicMaterial color="#60e7be" depthTest={false}/></mesh>)}</group></>;
}
