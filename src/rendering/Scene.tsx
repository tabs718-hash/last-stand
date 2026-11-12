import {FractureEffects} from './FractureEffects';
import type {EnergyMode} from '../combat/WeaponProfiles';
import {useFrame,useThree} from '@react-three/fiber';
import {memo,useEffect,useLayoutEffect,useRef} from 'react';
import {PerspectiveCamera} from 'three';
import type {GameEngine} from '../core/GameEngine';
import type {SimulationLoop} from '../core/SimulationLoop';
import {CowboyModel,type AssetStatus} from './AssetModels';
import {CharacterPart} from './CharacterView';
import {PhysicsOverlay} from './PhysicsOverlay';
import {Environment} from './Environment';
import {FirstPersonCamera} from './FirstPersonCamera';
import {ImpactEffects} from './ImpactEffects';
import type {DebugSettings} from './DebugSettings';
function InspectionCamera({duel,view}:{duel:boolean;view:'front'|'side'|'back'}){
 const {camera}=useThree();
 useLayoutEffect(()=>{if(duel)return;camera.position.set(...(view==='front'?[3,2.1,6]:view==='back'?[-3,2.1,-6]:[5,1.6,.6]) as [number,number,number]);camera.lookAt(0,.9,0);const perspective=camera as PerspectiveCamera;perspective.fov=34;perspective.updateProjectionMatrix()},[camera,duel,view]);
 return null;
}
export const Scene=memo(function Scene({engine,loop,debug,duel,settings,view,onAssetStatus,weaponProfile}:{engine:GameEngine;loop:SimulationLoop;debug:boolean;duel:boolean;settings:DebugSettings;view:'front'|'side'|'back';onAssetStatus?:(status:AssetStatus)=>void;weaponProfile?:EnergyMode}){
 const a=useRef(1),rig=engine.rig;
 // Dispose only after this renderer has detached all callbacks using the old world.
 useEffect(()=>()=>engine.dispose(),[engine]);
 useFrame((_,dt)=>{a.current=loop.advance(dt)},-1);
 return <><InspectionCamera duel={duel} view={view}/><Environment distance={duel?engine.duelDistance:12}/>{!duel&&<gridHelper args={[12,24,'#897a65','#a1937e']} position={[0,.002,0]}/>}{<CowboyModel hidden={settings.mannequin} onStatus={onAssetStatus} rig={rig} alpha={()=>a.current} fallback={<>{rig.parts.map(p=><CharacterPart key={p.name} part={p} alpha={()=>a.current} debug={false}/>)}</>}/>} {rig.allParts.map(p=><CharacterPart key={p.name} part={p} profile={engine.mode==='lab'?weaponProfile:'LOW'} alpha={()=>a.current} debug={debug&&settings.colliders} hidden={(!settings.mannequin&&rig.parts.includes(p))||(p.name==='Head'&&rig.fragments.destroyed)} hitboxes={debug&&settings.hitboxes&&rig.parts.includes(p)}/>)}{debug&&<PhysicsOverlay rig={rig} settings={settings}/>}<FractureEffects rig={rig}/><ImpactEffects rig={rig} debug={debug&&settings.shots}/>{duel&&<FirstPersonCamera engine={engine} loop={loop} profile={weaponProfile} debug={debug}/>}</>;
});
