import type R from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import type {Part} from './CharacterTypes';

export interface FootSupport {
  part: Part;
  points: Vector3[];
  load: number;
  ability: number;
}

// Monotone-chain convex hull on the horizontal (x,z) plane.
export function supportHull(points: Vector3[]): Vector3[] {
  const sorted = points.slice().sort((a,b) => a.x-b.x || a.z-b.z);
  const cross = (a:Vector3,b:Vector3,c:Vector3) => (b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
  const half = (list:Vector3[]) => {
    const result:Vector3[]=[];
    for(const point of list){
      while(result.length>1 && cross(result[result.length-2],result[result.length-1],point)<=1e-8) result.pop();
      result.push(point);
    }
    return result;
  };
  if(sorted.length<3) return sorted;
  return [...half(sorted).slice(0,-1), ...half(sorted.reverse()).slice(0,-1)];
}

export class SupportDetector {
  feet:FootSupport[]=[];
  hull:Vector3[]=[];
  points:Vector3[]=[];
  center=new Vector3();
  constructor(private world:R.World, private ground:R.Collider, private parts:Part[]){}

  update(dt:number){
    this.feet=[];
    this.points=[];
    this.center.set(0,0,0);
    let weight=0;
    for(const part of this.parts.filter(p=>p.name.endsWith('foot'))){
      const support:FootSupport={part,points:[],load:0,ability:part.functionality};
      this.world.contactPair(part.body.collider(0),this.ground,(manifold)=>{
        if(Math.abs(manifold.normal().y)<.6) return;
        for(let i=0;i<manifold.numSolverContacts();i++){
          if(manifold.solverContactDist(i)>.003) continue;
          support.points.push(new Vector3().copy(manifold.solverContactPoint(i)));
        }
        for(let i=0;i<manifold.numContacts();i++) support.load+=Math.max(0,manifold.contactImpulse(i))/dt;
      });
      if(support.points.length){
        this.feet.push(support);
        this.points.push(...support.points);
        const center=new Vector3();
        for(const p of support.points) center.add(p);
        center.divideScalar(support.points.length);
        this.center.addScaledVector(center,support.ability*support.ability);
        weight+=support.ability*support.ability;
      }
    }
    if(weight>0) this.center.divideScalar(weight);
    this.hull=supportHull(this.points);
  }

  margin(point:Vector3):number {
    if(this.hull.length<3) return -Infinity;
    let margin=Infinity;
    for(let i=0;i<this.hull.length;i++){
      const a=this.hull[i],b=this.hull[(i+1)%this.hull.length];
      const dx=b.x-a.x,dz=b.z-a.z;
      margin=Math.min(margin,(dx*(point.z-a.z)-dz*(point.x-a.x))/Math.hypot(dx,dz));
    }
    return margin;
  }
}
