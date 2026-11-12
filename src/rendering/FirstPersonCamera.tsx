import type {EnergyMode} from '../combat/WeaponProfiles';
import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {Group,PerspectiveCamera,Quaternion,Vector3} from 'three';
import type {GameEngine} from '../core/GameEngine';
import type {SimulationLoop} from '../core/SimulationLoop';
import {AimInput} from '../input/AimInput';
import {recoilAt} from '../input/WeaponPresentation';
import {AssetProp} from './AssetModels';
import {RevolverModel} from './WeaponView';
export function FirstPersonCamera({engine,loop,debug,profile}:{engine:GameEngine;loop:SimulationLoop;debug:boolean;profile?:EnergyMode}){
 const {camera,gl}=useThree();const aim=useRef(new AimInput()),weapon=useRef<Group>(null!),holster=useRef<Group>(null!),hand=useRef<Group>(null!),bodyView=useRef<Group>(null!);
 const debugRef=useRef(debug);debugRef.current=debug;
 const recoil=()=>recoilAt(engine.rig.time-engine.playerShotAt);
 useEffect(()=>{
  aim.current=new AimInput();
  const canvas=gl.domElement;let locked=false;
  const move=(event:MouseEvent)=>{
   if(loop.paused||engine.rules.terminal)return;
   if(document.pointerLockElement===canvas)aim.current.moveRelative(event.movementX,event.movementY);
   else if(event.target===canvas){const bounds=canvas.getBoundingClientRect();aim.current.moveAbsolute(event.clientX-bounds.left,event.clientY-bounds.top,bounds.width,bounds.height)}
  };
  const shoot=(event:MouseEvent)=>{
   if(!engine.acceptsInput||loop.paused||document.hidden||debugRef.current)return;
   if(event.button===2){aim.current.zoom=true;return}
   if(event.button!==0)return;
   const lock=canvas.requestPointerLock?.();if(lock&&typeof lock.catch==='function')void lock.catch(()=>{});
   aim.current.origin.copy(engine.playerBody.eye());
  const snapshot=aim.current.snapshot(recoil(),engine.rules.drawProgress);
   if(engine.playerEquipment){engine.playerEquipment.cameraPosition.copy(snapshot.camera);engine.playerEquipment.cameraRotation.copy(snapshot.rotation);engine.playerEquipment.ads=aim.current.ads;engine.playerEquipment.recoil=recoil()}
   engine.trigger(snapshot.camera,snapshot.direction,engine.playerEquipment?.muzzle()??snapshot.muzzle);
  };
  const up=(event?:MouseEvent)=>{if(!event||event.button===2)aim.current.release()};
  const blur=()=>up();
  const lockChanged=()=>{
   const isLocked=document.pointerLockElement===canvas;
   if(locked&&!isLocked){aim.current.release();if(!engine.rules.terminal&&engine.rules.phase!=='idle')loop.paused=true}
   locked=isLocked;
  };
  const look=(event:KeyboardEvent)=>{if(event.code==='KeyF'&&!loop.paused&&!debugRef.current&&!event.repeat&&!(event.target as HTMLElement)?.isContentEditable&&!(event.target as HTMLElement)?.matches?.('input,textarea,select'))engine.reload();if(event.code==='KeyV'&&!loop.paused&&!event.repeat&&!(event.target as HTMLElement)?.isContentEditable&&!(event.target as HTMLElement)?.matches?.('input,textarea,select'))aim.current.pitch=aim.current.pitch<-.8?0:-1.15};
  window.addEventListener('keydown',look);
  const menu=(event:Event)=>event.preventDefault();
  canvas.addEventListener('mousedown',shoot);canvas.addEventListener('contextmenu',menu);
  document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);document.addEventListener('pointerlockchange',lockChanged);window.addEventListener('blur',blur);
  return()=>{
   loop.paused=true;
   window.removeEventListener('keydown',look);
   canvas.removeEventListener('mousedown',shoot);canvas.removeEventListener('contextmenu',menu);
   document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);document.removeEventListener('pointerlockchange',lockChanged);window.removeEventListener('blur',blur);
   if(document.pointerLockElement===canvas)document.exitPointerLock();
  };
 },[camera,gl,engine,loop]);
 useEffect(()=>{if(debug){aim.current.release();loop.paused=true;if(document.pointerLockElement===gl.domElement)document.exitPointerLock()}},[debug,gl,loop]);
 useFrame((_,dt)=>{
  if(loop.paused||engine.rules.terminal)aim.current.release();
  if(!loop.paused)aim.current.advance(dt,engine.rules.playerDrawn&&!engine.rules.terminal);
  aim.current.origin.copy(engine.playerBody.eye());
  const snapshot=aim.current.snapshot(recoil(),engine.rules.drawProgress);
  camera.position.copy(snapshot.camera);camera.quaternion.copy(snapshot.rotation);
  if((loop.paused||engine.rules.terminal)&&document.pointerLockElement===gl.domElement)document.exitPointerLock();
  const perspective=camera as PerspectiveCamera;
  const fov=45-10*aim.current.ads;if(Math.abs(perspective.fov-fov)>.01){perspective.fov=fov;perspective.updateProjectionMatrix()}
  bodyView.current.position.copy(engine.playerBody.body.translation());bodyView.current.quaternion.copy(engine.playerBody.body.rotation());
  const equipment=engine.playerEquipment;
  if(equipment){
   equipment.cameraPosition.copy(snapshot.camera);equipment.cameraRotation.copy(snapshot.rotation);equipment.ads=aim.current.ads;equipment.recoil=recoil();
   const blend=1;
   for(const [group,key] of [[weapon.current,'gun'],[holster.current,'holster'],[hand.current,'hand']] as const){group.position.lerpVectors(equipment.previous[key],equipment[key].translation(),blend);group.quaternion.slerpQuaternions(equipment.previousQ[key],new Quaternion().copy(equipment[key].rotation()),blend)}
   weapon.current.visible=true;hand.current.visible=engine.rules.drawProgress>0;
  }else{weapon.current.visible=engine.rules.drawProgress>0;weapon.current.position.copy(snapshot.weapon.position);weapon.current.quaternion.copy(snapshot.weapon.rotation);holster.current.visible=false;hand.current.visible=false}

 });
 return <><group ref={weapon}><RevolverModel profile={profile}/></group><group ref={holster}><AssetProp url="/assets/holster.glb"/></group><group ref={hand}><mesh position={[0,-.1,-.085]} rotation={[.1,0,0]}><capsuleGeometry args={[.04,.09,5,16]}/><meshStandardMaterial color="#694530" roughness={.65}/></mesh><mesh position={[.032,-.065,-.055]}><capsuleGeometry args={[.018,.047,4,12]}/><meshStandardMaterial color="#694530" roughness={.65}/></mesh></group><group ref={bodyView}><mesh position={[0,.1,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.19,.018,8,32]}/><meshStandardMaterial color="#432b1c"/></mesh>{[-1,1].map(s=><mesh key={s} position={[s*.12,-.25,0]}><capsuleGeometry args={[.105,.38,4,16]}/><meshStandardMaterial color="#344349"/></mesh>)}</group></>;
}
