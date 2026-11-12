import type {EnergyMode} from '../combat/WeaponProfiles';
import {useFrame} from '@react-three/fiber';
import {useEffect,useMemo,useRef} from 'react';
import {Group,Quaternion,Vector3} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {hitboxSize} from '../config/hitboxes';
import type {Part} from '../character/CharacterTypes';
import {AssetProp} from './AssetModels';
import {RevolverModel} from './WeaponView';
export function CharacterPart({part,alpha,debug,hidden=false,hitboxes=false,profile='LOW'}:{part:Part;alpha:()=>number;debug:boolean;hidden?:boolean;hitboxes?:boolean;profile?:EnergyMode}){
  const group=useRef<Group>(null!);
  const body=!['Revolver','Hat','Holster'].includes(part.name);
  const geometry=useMemo(()=>!hidden&&body?new RoundedBoxGeometry(...part.size,2,Math.min(...part.size)*.18):null,[part,hidden,body]);
  useEffect(()=>()=>geometry?.dispose(),[geometry]);
  useFrame(()=>{
    group.current.visible=!part.destroyed;
    group.current.position.lerpVectors(part.previous,new Vector3().copy(part.body.translation()),alpha());
    group.current.quaternion.slerpQuaternions(part.previousQ,new Quaternion().copy(part.body.rotation()),alpha());
  });
  const skin=part.name==='Head'||part.name.includes('hand');
  const color=skin?'#bb977c':part.name.includes('foot')?'#302b26':/thigh|shin|Pelvis/.test(part.name)?'#4e5147':/Chest|Abdomen/.test(part.name)?'#514533':'#a09980';
  return <group ref={group}>
    {!hidden&&<group>{part.name==='Revolver'?<RevolverModel profile={profile}/>:part.name==='Holster'?<AssetProp url="/assets/holster.glb"/>:part.name==='Hat'?<AssetProp url="/assets/hat.glb" fallback={<group><mesh castShadow><cylinderGeometry args={[.18,.18,.025,32]}/><meshStandardMaterial color="#3e3328" roughness={.85}/></mesh><mesh position={[0,.045,0]} castShadow><cylinderGeometry args={[.084,.103,.09,24]}/><meshStandardMaterial color="#564331" roughness={.9}/></mesh><mesh position={[0,.017,0]}><cylinderGeometry args={[.104,.104,.02,24]}/><meshStandardMaterial color="#27231e"/></mesh></group>}/>:<mesh geometry={geometry!} castShadow><meshStandardMaterial color={color} roughness={.85}/></mesh>}
    </group>}{debug&&<mesh><boxGeometry args={part.size}/><meshBasicMaterial color={part.functionality<.5?'#e87953':'#7de0c9'} wireframe transparent opacity={.65} depthTest={false}/></mesh>}
    {hitboxes&&<mesh><boxGeometry args={hitboxSize(part.name,part.size)}/><meshBasicMaterial color="#d78b55" wireframe transparent opacity={.65} depthTest={false}/></mesh>}
    {!hidden&&part.name==='Head'&&<group><mesh position={[0,-.005,.1]}><sphereGeometry args={[.025,12,8]}/><meshStandardMaterial color="#a78064"/></mesh>{[-1,1].map(s=><mesh key={s} position={[s*.043,.027,.094]}><sphereGeometry args={[.007,8,6]}/><meshStandardMaterial color="#292e27"/></mesh>)}<mesh position={[0,-.06,.089]}><boxGeometry args={[.07,.018,.012]}/><meshStandardMaterial color="#635140"/></mesh></group>}
    {!hidden&&part.name==='Chest'&&[-1,0,1].map(y=><mesh key={y} position={[0,y*.07,.113]}><sphereGeometry args={[.007,8,6]}/><meshStandardMaterial color="#a69f7c" metalness={.3}/></mesh>)}
  </group>;
}
