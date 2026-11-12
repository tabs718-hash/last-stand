import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {BufferGeometry,Float32BufferAttribute,Line,LineBasicMaterial,Group,Vector3,Mesh,MeshBasicMaterial} from 'three';
import type {Rig} from '../character/Rig';
import type {ShotRecord} from '../combat/BallisticsSystem';
function ShotEffect({rig,slot,debug}:{rig:Rig;slot:number;debug:boolean}){
 const group=useRef<Group>(null!),smoke=useRef<Group>(null!),flash=useRef<Mesh>(null!),dust=useRef<Group>(null!);
 const record=useRef<ShotRecord|null>(null);
 const line=useMemo(()=>new Line(new BufferGeometry().setAttribute('position',new Float32BufferAttribute([0,0,0,0,0,0],3)),new LineBasicMaterial({color:'#ffe1a2',transparent:true,opacity:.5,depthWrite:false})),[]);
 useEffect(()=>()=>{line.geometry.dispose();(line.material as LineBasicMaterial).dispose()},[line]);
 useFrame(()=>{
  const history=rig.ballistics.history,shot=history[history.length-1-slot];
  const age=shot?Math.max(0,rig.time-shot.time):10;
  const active=!!shot&&(age<1.1||(debug&&slot===0));
  group.current.visible=active;if(!active||!shot)return;
  if(record.current!==shot){
   record.current=shot;const p=line.geometry.getAttribute('position');p.setXYZ(0,...shot.origin.toArray());p.setXYZ(1,...shot.end.toArray());p.needsUpdate=true;line.frustumCulled=false;
  }
  flash.current.visible=age<.045;flash.current.position.copy(shot.origin);flash.current.scale.setScalar(.025+Math.max(0,1-age/.045)*.035);
  line.visible=debug&&slot===0||age<.055;(line.material as LineBasicMaterial).opacity=debug&&slot===0?.45:Math.max(0,(1-age/.055)*.5);
  smoke.current.visible=age<1.1;smoke.current.position.copy(shot.origin);
  smoke.current.children.forEach((object,i)=>{
   const mesh=object as Mesh,drift=age*(.08+i*.03);mesh.position.set(Math.sin(i*3)*drift,age*.2,Math.cos(i*2)*drift);mesh.scale.setScalar(.018+age*(.055+i*.02));(mesh.material as MeshBasicMaterial).opacity=Math.max(0,(1-age/1.1)*.11);
  });
  const hit=shot.hits[0];dust.current.visible=!!hit&&age<.55;
  if(hit){
   const metal=hit.zone==='weapon',organic=!!hit.entry.part;dust.current.position.copy(hit.entryPoint);
   dust.current.children.forEach((object,i)=>{
    const mesh=object as Mesh,a=i*2.4;const drift=new Vector3(Math.sin(a),.6+Math.cos(a*.7)*.35,Math.cos(a)).addScaledVector(hit.impactNormal,1.3).multiplyScalar(age*(metal?.7:.3));
    drift.y-=age*age*.65;mesh.position.copy(drift);mesh.scale.setScalar((metal?.006:.014)*(1+age));const material=mesh.material as MeshBasicMaterial;material.color.set(metal?'#ffe5a1':organic?'#861e1a':'#a99071');material.opacity=Math.max(0,1-age/.55);
   });
  }
 });
 return <group ref={group} visible={false}><primitive object={line}/><mesh ref={flash}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color="#fff2be" transparent opacity={.85} depthWrite={false}/></mesh><group ref={smoke}>{Array.from({length:3},(_,i)=><mesh key={i}><sphereGeometry args={[1,8,6]}/><meshBasicMaterial color="#c7bfad" transparent depthWrite={false}/></mesh>)}</group><group ref={dust}>{Array.from({length:6},(_,i)=><mesh key={i}><sphereGeometry args={[1,6,4]}/><meshBasicMaterial transparent depthWrite={false}/></mesh>)}</group></group>;
}
export function ImpactEffects({rig,debug}:{rig:Rig;debug:boolean}){
 return <>{Array.from({length:4},(_,slot)=><ShotEffect key={slot} rig={rig} slot={slot} debug={debug}/>)}</>;
}
