import {useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Group,Mesh} from 'three';
import type {Rig} from '../character/Rig';
export function FractureEffects({rig}:{rig:Rig}){
 const group=useRef<Group>(null!);
 useFrame(()=>{group.current.children.forEach((object,i)=>{const piece=rig.fragments.pieces[i];object.visible=!!piece;if(piece){object.position.copy(piece.body.translation());object.quaternion.copy(piece.body.rotation());object.scale.set(piece.size*(i%2?1.2:.9),piece.size*.85,piece.size*1.1)}})});
 return <group ref={group}>{Array.from({length:18},(_,i)=><group key={i} visible={false}><mesh castShadow><dodecahedronGeometry args={[1,0]}/><meshStandardMaterial color={i%3?'#a77d63':'#641b18'} roughness={.65}/></mesh><mesh position={[0,0,.65]} rotation={[.3,i,.2]}><circleGeometry args={[.65,5]}/><meshStandardMaterial color="#7d211b" roughness={.38} side={2}/></mesh></group>)}</group>;
}
