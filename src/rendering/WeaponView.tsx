import {VERSION} from '../config/version';
import {WEAPON_PROFILES,type EnergyMode} from '../combat/WeaponProfiles';
import {AssetProp} from './AssetModels';
function ProceduralRevolver(){return <group>
  <mesh castShadow position={[0,.025,.065]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.013,.016,.22,16]}/><meshStandardMaterial color="#889092" metalness={.9} roughness={.27}/></mesh>
  <mesh position={[0,.044,.165]}><boxGeometry args={[.009,.012,.012]}/><meshStandardMaterial color="#414846" metalness={.8}/></mesh>
  <mesh castShadow position={[0,.018,-.055]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.035,.035,.065,12]}/><meshStandardMaterial color="#727e7e" metalness={.85} roughness={.32}/></mesh>
  <mesh castShadow position={[0,.002,-.07]}><boxGeometry args={[.048,.055,.115]}/><meshStandardMaterial color="#53605e" metalness={.85} roughness={.33}/></mesh>
  <mesh castShadow position={[0,-.065,-.09]} rotation={[-.28,0,0]}><boxGeometry args={[.045,.11,.05]}/><meshStandardMaterial color="#4c2d1e" roughness={.6}/></mesh>
  <mesh position={[0,-.042,-.025]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.025,.004,6,12]}/><meshStandardMaterial color="#6d7674" metalness={.9} roughness={.3}/></mesh>
  <mesh position={[0,.054,-.105]} rotation={[-.3,0,0]}><boxGeometry args={[.014,.025,.024]}/><meshStandardMaterial color="#434e4b" metalness={.9}/></mesh>
</group>}

export function RevolverModel({profile='LOW'}:{profile?:EnergyMode}){const url=WEAPON_PROFILES[profile].model+'?v='+VERSION;return <AssetProp key={url} url={url} fallback={<ProceduralRevolver/>}/>}
