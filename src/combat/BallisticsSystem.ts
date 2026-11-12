import type {PenetrationPolicy} from './WeaponProfiles';
import R from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3} from 'three';
import {EventBus} from '../core/EventBus';
import {CollisionRegistry} from '../physics/CollisionRegistry';
import {PenetrationSolver,type RayInterval,type HitEvent} from './PenetrationSolver';
export {SHOT_ENERGY,type EnergyMode} from './WeaponProfiles';
export interface ShotRecord {bodyPose?:Record<string,{position:Vector3;rotation:Quaternion}>;penetrationPolicy?:PenetrationPolicy;id:number;origin:Vector3;direction:Vector3;initialEnergy:number;time:number;hits:HitEvent[];end:Vector3}

export function boxInterval(origin:Vector3,direction:Vector3,center:Vector3,rotation:Quaternion,size:readonly number[]):[number,number]|null {
  const inv=rotation.clone().invert();
  const o=origin.clone().sub(center).applyQuaternion(inv),d=direction.clone().applyQuaternion(inv);
  let near=-Infinity,far=Infinity;
  for(let axis=0;axis<3;axis++){
    const a=o.getComponent(axis),b=d.getComponent(axis),half=size[axis]/2;
    if(Math.abs(b)<1e-9){if(Math.abs(a)>half)return null;continue}
    let t1=(-half-a)/b,t2=(half-a)/b;if(t1>t2)[t1,t2]=[t2,t1];
    near=Math.max(near,t1);far=Math.min(far,t2);if(near>far)return null;
  }
  if(far<0)return null;
  return [Math.max(0,near),far];
}

export class BallisticsSystem {
  events=new EventBus<{shot:ShotRecord}>();
  solver=new PenetrationSolver();
  sequence=0;
  lastProcessingMs=0;
  history:ShotRecord[]=[];
  lastShot:ShotRecord|null=null;
  constructor(private world:R.World,private registry:CollisionRegistry){}

  shoot(origin:Vector3,direction:Vector3,energy:number,time:number,ignored=new Set<string>(),penetrationPolicy:PenetrationPolicy='material'):ShotRecord {
    const started=performance.now();
    direction=direction.clone().normalize();
    const ray=new R.Ray(origin,direction),intervals:RayInterval[]=[];
    // Rapier supplies authoritative collider hits; OBB slabs supply exact exits and internal material spans.
    this.world.intersectionsWithRay(ray,80,true,intersection=>{
      const entry=this.registry.get(intersection.collider.handle);if(!entry||ignored.has(entry.id))return true;
      const center=new Vector3().copy(entry.collider.translation()),rotation=new Quaternion().copy(entry.collider.rotation());
      const span=boxInterval(origin,direction,center,rotation,entry.size);if(!span)return true;
      const start=Math.max(0,span[0]),end=Math.min(80,span[1]);if(end<=start)return true;
      let core=entry.coreResistance?boxInterval(origin,direction,center,rotation,entry.size.map(v=>v*.55)):null;
      let zone=entry.zone;
      if(zone==='shin' && entry.part){
        const local=origin.clone().addScaledVector(direction,start).sub(center).applyQuaternion(rotation.clone().invert());
        if(local.y>entry.size[1]*.25){zone='knee';core=boxInterval(origin,direction,center.clone().add(new Vector3(0,entry.size[1]*.36,0).applyQuaternion(rotation)),rotation,[entry.size[0]*.7,entry.size[1]*.27,entry.size[2]*.7]);}
      }
      intervals.push({entry,zone,start,end,normal:new Vector3().copy(intersection.normal),core:core?[Math.max(start,core[0]),Math.min(end,core[1])]:undefined});
      return true;
    });
    const hits=this.solver.solve(++this.sequence,origin,direction,energy,intervals,penetrationPolicy);
    const stop=hits.find(h=>h.stopPoint)?.stopPoint;
    const bodyPose:NonNullable<ShotRecord['bodyPose']>={};for(const e of this.registry.entries.values())if(e.part&&!bodyPose[e.part.name])bodyPose[e.part.name]={position:new Vector3().copy(e.part.body.translation()),rotation:new Quaternion().copy(e.part.body.rotation())};
    this.lastShot={bodyPose,penetrationPolicy,id:this.sequence,origin:origin.clone(),direction,initialEnergy:energy,time,hits,end:stop?.clone()??origin.clone().addScaledVector(direction,80)};
    this.history.push(this.lastShot);
    this.lastProcessingMs=performance.now()-started;
    this.events.emit('shot',this.lastShot);
    return this.lastShot;
  }

  fromCamera(camera:Vector3,direction:Vector3,muzzle:Vector3,energy:number,time:number,ignored=new Set<string>(),penetrationPolicy:PenetrationPolicy='material'){
    const hit=this.world.castRay(new R.Ray(camera,direction),80,true,undefined,undefined,undefined,undefined,collider=>{const entry=this.registry.get(collider.handle);return !!entry&&!ignored.has(entry.id)});
    const aim=camera.clone().addScaledVector(direction,hit?.timeOfImpact??80);
    return this.shoot(muzzle,aim.sub(muzzle).normalize(),energy,time,ignored,penetrationPolicy);
  }
}
