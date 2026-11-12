import {VERSION} from '../config/version';
import {useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {useFrame} from '@react-three/fiber';
import {Vector3,Mesh,Object3D,SkinnedMesh,Skeleton} from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js';
import type {Rig} from '../character/Rig';
import {AssetCache} from './AssetCache';
import {WoundDecals} from './WoundDecals';
import {PhysicalSkeletonAdapter} from './PhysicalSkeletonAdapter';
export const modelAssets=new AssetCache<GLTF>(url=>new GLTFLoader().loadAsync(url));
export function useAssetFailures(){return useSyncExternalStore(modelAssets.subscribeStatus,modelAssets.getStatus,modelAssets.getStatus)}
export type AssetStatus='loading'|'ready'|'error';
function useAsset(url:string,onStatus?:(status:AssetStatus)=>void){
 const [asset,setAsset]=useState<GLTF>();
 const retry=useSyncExternalStore(modelAssets.subscribeRetry,modelAssets.getRetryVersion,modelAssets.getRetryVersion);
 useEffect(()=>{let mounted=true;if(!asset)onStatus?.('loading');
  modelAssets.load(url.startsWith('/')?'.'+url:url).then(g=>{if(mounted){setAsset(g);onStatus?.('ready')}}).catch(e=>{if(mounted)onStatus?.('error');console.error('Asset load failed',url,e)});
  return()=>{mounted=false};},[url,onStatus,retry]);return asset;
}

function prepare(root:Object3D){root.traverse(o=>{if(o instanceof Mesh){o.castShadow=true;o.receiveShadow=true}});return root}
export function AssetProp({url,fallback}:{url:string;fallback?:React.ReactNode}){
 const asset=useAsset(url),root=useMemo(()=>asset?prepare(asset.scene.clone(true)):null,[asset]);
 return root?<primitive object={root} dispose={null}/>:fallback??(url.includes('holster')?<group>{[-1,1].map(side=><mesh key={side} position={[side*.047,0,.02]}><boxGeometry args={[.008,.28,.11]}/><meshStandardMaterial color="#68422b" roughness={.8}/></mesh>)}<mesh position={[0,-.145,.02]}><boxGeometry args={[.09,.01,.11]}/><meshStandardMaterial color="#68422b"/></mesh><mesh position={[0,0,-.025]}><boxGeometry args={[.09,.28,.008]}/><meshStandardMaterial color="#68422b"/></mesh></group>:null);
}
export function CowboyModel({rig,alpha,fallback,onStatus,hidden=false}:{rig:Rig;alpha:()=>number;fallback:React.ReactNode;onStatus?:(status:AssetStatus)=>void;hidden?:boolean}){
 const asset=useAsset('/assets/cowboy.glb?v='+VERSION,onStatus);
 const visual=useMemo(()=>{if(!asset)return null;const root=prepare(clone(asset.scene));return {root,adapter:new PhysicalSkeletonAdapter(root,rig),wounds:new WoundDecals(root,32),lastTime:-1,lastAlpha:-1}},[asset,rig]);
 useEffect(()=>{if(!visual)return;for(const shot of rig.ballistics.history.slice(-32)){if(shot.bodyPose)visual.adapter.updateFromPose(shot.bodyPose);else visual.adapter.update(1);visual.wounds.captureShot(shot)}visual.adapter.update(1);visual.wounds.update();return rig.ballistics.events.on('shot',shot=>{visual.adapter.update(1);visual.wounds.captureShot(shot)})},[visual,rig]);
 useEffect(()=>()=>{if(visual){visual.wounds.dispose();const skeletons=new Set<Skeleton>();visual.root.traverse(o=>{if(o instanceof SkinnedMesh)skeletons.add(o.skeleton)});skeletons.forEach(s=>s.dispose())}},[visual]);
 useFrame(()=>{if(visual){visual.root.visible=!hidden;visual.wounds.group.visible=!hidden;
   if(hidden)return;const a=alpha();if(visual.lastTime===rig.time&&visual.lastAlpha===a)return;
   visual.adapter.update(a);if(rig.fragments.destroyed)visual.wounds.destroyHead(new Vector3().copy(rig.part('Head').body.translation()));visual.wounds.update();visual.lastTime=rig.time;visual.lastAlpha=a}});
 return visual?<><primitive object={visual.root} dispose={null}/><primitive object={visual.wounds.group} dispose={null}/></>:hidden?null:fallback;
}
