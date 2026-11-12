import {SurfaceDamage} from './SurfaceDamage';
import {CylinderGeometry,Quaternion,BufferAttribute,BufferGeometry,DoubleSide,Group,Matrix4,Mesh,MeshStandardMaterial,Object3D,Ray,SkinnedMesh,Triangle,Vector3} from 'three';
import type {ShotRecord} from '../combat/BallisticsSystem';
import {createWoundTextures} from './WoundTextures';
type SurfaceMesh=Mesh|SkinnedMesh;
interface Face {mesh:SurfaceMesh;indices:[number,number,number];a:Vector3;b:Vector3;c:Vector3;normal:Vector3}
interface SurfaceHit {face:Face;point:Vector3;t:number}
interface ClipVertex {bary:Vector3;u:number;v:number}
interface Sample {mesh:SurfaceMesh;index:number;position:Vector3;users:number}
interface Anchor {mesh:SurfaceMesh;indices:[number,number,number];bary:Vector3;samples?:[Sample,Sample,Sample]}
export interface WoundMark {shotId:number;kind:'entry'|'exit';mesh:Mesh;anchors:Anchor[];center:Anchor;sourcePart:string}
const WIDTH=.13,HEIGHT=.16,OFFSET=.00065;
const policyOf=(shot:ShotRecord)=>(shot as ShotRecord&{penetrationPolicy?:'stop'|'through'|'material'}).penetrationPolicy??'material';
function vertex(mesh:SurfaceMesh,index:number,out=new Vector3()){
 out.fromBufferAttribute(mesh.geometry.getAttribute('position'),index);
 if(mesh instanceof SkinnedMesh)mesh.applyBoneTransform(index,out);
 return out.applyMatrix4(mesh.matrixWorld);
}
function weights(a:ClipVertex,b:ClipVertex,t:number):ClipVertex{return {bary:a.bary.clone().lerp(b.bary,t),u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t}}
function clip(polygon:ClipVertex[],axis:'u'|'v',bound:number,greater:boolean){
 const result:ClipVertex[]=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],av=a[axis]-bound,bv=b[axis]-bound,insideA=greater?av>=0:av<=0,insideB=greater?bv>=0:bv<=0;
  if(insideA)result.push(a);if(insideA!==insideB)result.push(weights(a,b,av/(av-bv)));
 }return result;
}
/** Persistent surface patches anchored to the ORIGINAL triangle barycentrics.
 * update() evaluates the same skinned vertices as the avatar, so a wound cannot
 * stay behind when the torso/limb rotates, interpolates, or falls. No physics writes. */
export class WoundDecals {
 readonly group=new Group();
 readonly surface:SurfaceDamage;
 readonly channels:{entry:WoundMark;exit:WoundMark;mesh:Mesh;entryRadius:number;exitRadius:number}[]=[];
 readonly marks:WoundMark[]=[];
 private meshes:SurfaceMesh[]=[];
 private seen=new Set<number>();
 private samples=new Map<SurfaceMesh,Map<number,Sample>>();
 private captureVertices=new Map<SurfaceMesh,Map<number,Vector3>>();
 private captureFaces:Face[]=[];
 private inverse=new Matrix4();private normalRotation=new Matrix4();
 private edgeA=new Vector3();private edgeB=new Vector3();private normal=new Vector3();private point=new Vector3();
 private textures=[createWoundTextures(false),createWoundTextures(true)];
 private materials=this.textures.map(t=>new MeshStandardMaterial({map:t.color,normalMap:t.normal,roughnessMap:t.roughness,roughness:1,metalness:0,transparent:true,alphaTest:.025,depthWrite:false,side:DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
 constructor(private root:Object3D,readonly maxMarks=32){
  this.surface=new SurfaceDamage(root);this.materials.forEach(m=>this.surface.bind(m));
  this.group.name='Persistent wounds';this.group.userData.wounds=true;
  root.traverse(o=>{if(o instanceof Mesh&&!o.userData.wounds&&o.geometry.getAttribute('position')){const materials=Array.isArray(o.material)?o.material:[o.material];if(materials.length===1&&/brass|eye white|iris|pupil/i.test(materials[0].name))return;this.meshes.push(o)}});
 }
 private prepare(){this.root.updateMatrixWorld(true)}
 private faces(){
  if(!this.captureFaces.length){
   for(const mesh of this.meshes){
    const geometry=mesh.geometry,index=geometry.index,count=index?.count??geometry.getAttribute('position').count,cache=new Map<number,Vector3>();this.captureVertices.set(mesh,cache);
    const at=(i:number)=>{if(!cache.has(i))cache.set(i,new Vector3());return cache.get(i)!};
    for(let i=0;i<count;i+=3){const ids:[number,number,number]=[index?index.getX(i):i,index?index.getX(i+1):i+1,index?index.getX(i+2):i+2];this.captureFaces.push({mesh,indices:ids,a:at(ids[0]),b:at(ids[1]),c:at(ids[2]),normal:new Vector3()})}
   }
  }
  for(const [mesh,vertices] of this.captureVertices)for(const [index,p] of vertices)vertex(mesh,index,p);
  for(const f of this.captureFaces)f.normal.crossVectors(this.edgeA.subVectors(f.b,f.a),this.edgeB.subVectors(f.c,f.a)).normalize();
  return this.captureFaces;
 }
 private sample(mesh:SurfaceMesh,index:number){
  let vertices=this.samples.get(mesh);if(!vertices){vertices=new Map();this.samples.set(mesh,vertices)}
  let s=vertices.get(index);if(!s){s={mesh,index,position:new Vector3(),users:0};vertices.set(index,s)}s.users++;return s;
 }
 private remove(mark:WoundMark){
  this.group.remove(mark.mesh);mark.mesh.geometry.dispose();
  for(const a of mark.anchors)for(const s of a.samples??[]){if(--s.users===0){const vertices=this.samples.get(s.mesh)!;vertices.delete(s.index);if(!vertices.size)this.samples.delete(s.mesh)}}
 }
 captureShot(shot:ShotRecord){
  if(this.seen.has(shot.id))return 0;this.seen.add(shot.id);
  // Bound dedup state as well as GPU meshes. IDs increase monotonically per world.
  if(this.seen.size>512)this.seen.delete(this.seen.values().next().value!);
  const bodyHits=shot.hits.filter(h=>!!h.entry.part);if(!bodyHits.length)return 0;
  this.prepare();const direction=shot.direction.clone().normalize(),ray=new Ray(shot.origin,direction),faces=this.faces(),surfaceHits:SurfaceHit[]=[];
  for(const face of faces){const point=ray.intersectTriangle(face.a,face.b,face.c,false,new Vector3());if(point)surfaceHits.push({face,point,t:point.clone().sub(shot.origin).dot(direction)})}
  surfaceHits.sort((a,b)=>a.t-b.t);
  const along=(v:Vector3)=>v.clone().sub(shot.origin).dot(direction);
  const ranges=bodyHits.map(h=>({lo:along(h.entryPoint),hi:along(h.exitPoint??h.stopPoint??h.entryPoint),exit:!!h.exitPoint&&h.penetrated,part:h.colliderId})).sort((a,b)=>a.lo-b.lo);
  const clusters:typeof ranges=[];
  for(const r of ranges){const last=clusters.at(-1);if(last&&r.lo<=last.hi+.035){if(r.hi>last.hi){last.hi=r.hi;last.exit=r.exit}}else clusters.push({...r})}
  const policy=policyOf(shot);let added=0;
  for(const cluster of clusters){
   const entry=surfaceHits.filter(h=>h.face.normal.dot(direction)<-.08&&Math.abs(h.t-cluster.lo)<.18).sort((a,b)=>a.t-b.t)[0]??this.nearestSurface(faces,shot.origin.clone().addScaledVector(direction,cluster.lo),direction,false,shot.origin);
   if(!entry)continue;
   if(this.add(entry,false,shot.id,cluster.part,faces,policy==='through'?shot.initialEnergy>10000?1.7:1.3:1))added++;
   const entryMark=this.marks.at(-1);
   if(policy!=='stop'&&cluster.exit){
    const exit=surfaceHits.filter(h=>h.t>entry.t+.025&&h.face.normal.dot(direction)>.08&&Math.abs(h.t-cluster.hi)<.18).sort((a,b)=>b.t-a.t)[0]??this.nearestSurface(faces,shot.origin.clone().addScaledVector(direction,cluster.hi),direction,true,shot.origin);
    if(exit&&this.add(exit,true,shot.id,cluster.part,faces,shot.initialEnergy>10000?1.8:1.6)){added++;if(policy==='through'&&entryMark){const power=shot.initialEnergy>10000,entryRadius=power?.04:.022,exitRadius=power?.058:.034;const mesh=new Mesh(new CylinderGeometry(entryRadius,exitRadius,1,24,1,true),new MeshStandardMaterial({color:'#6c1816',roughness:.34,side:DoubleSide}));mesh.name='Open wound channel';mesh.userData.wounds=true;this.channels.push({entry:entryMark,exit:this.marks.at(-1)!,mesh,entryRadius,exitRadius});this.group.add(mesh)}}
   }
   if(policy==='stop')break;
  }
  this.update();return added;
 }
 private nearestSurface(faces:Face[],target:Vector3,direction:Vector3,exit:boolean,origin:Vector3){
  let best:SurfaceHit|undefined,distance=.18;
  // A coarse box can register a grazing corner outside the render mesh. Keep a
  // visible hit by projecting to the nearest facing garment instead of dropping it.
  for(const face of faces){
   const facing=face.normal.dot(direction);if(exit?facing<=.005:facing>=-.005)continue;
   const point=new Triangle(face.a,face.b,face.c).closestPointToPoint(target,new Vector3()),d=point.distanceTo(target);
   if(d<distance){distance=d;best={face,point,t:point.clone().sub(origin).dot(direction)}}
  }return best;
 }
 private add(hit:SurfaceHit,exit:boolean,shotId:number,sourcePart:string,faces:Face[],scale=1){
  const n=hit.face.normal,up=new Vector3(0,1,0).addScaledVector(n,-n.y).normalize();if(up.lengthSq()<.1)up.set(0,0,1).addScaledVector(n,-n.z).normalize();const right=new Vector3().crossVectors(up,n).normalize();
  const anchors:Anchor[]=[],uvs:number[]=[];
  for(const face of faces){
   if(face.mesh!==hit.face.mesh||face.normal.dot(n)<.3)continue;
   const points=[face.a,face.b,face.c],depths=points.map(v=>v.clone().sub(hit.point).dot(n));
   if(Math.min(...depths)>.016||Math.max(...depths)<-.016)continue;
   let poly=points.map((p,i)=>{const delta=p.clone().sub(hit.point);return {bary:new Vector3(i===0?1:0,i===1?1:0,i===2?1:0),u:delta.dot(right)/(WIDTH*scale)+.5,v:delta.dot(up)/(HEIGHT*scale)+.62}});
   if(Math.min(...poly.map(p=>p.u))>1||Math.max(...poly.map(p=>p.u))<0||Math.min(...poly.map(p=>p.v))>1||Math.max(...poly.map(p=>p.v))<0)continue;
   for(const [axis,bound,greater] of [['u',0,true],['u',1,false],['v',0,true],['v',1,false]] as const){if(!poly.length)break;poly=clip(poly,axis,bound,greater)}
   for(let i=1;i+1<poly.length;i++)for(const p of [poly[0],poly[i],poly[i+1]]){anchors.push({mesh:face.mesh,indices:face.indices,bary:p.bary,samples:[this.sample(face.mesh,face.indices[0]),this.sample(face.mesh,face.indices[1]),this.sample(face.mesh,face.indices[2])]});uvs.push(p.u,p.v)}
  }
  if(!anchors.length)return false;
  const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(new Float32Array(anchors.length*3),3));geometry.setAttribute('normal',new BufferAttribute(new Float32Array(anchors.length*3),3));geometry.setAttribute('uv',new BufferAttribute(new Float32Array(uvs),2));
  const mesh=new Mesh(geometry,this.materials[exit?1:0]);mesh.name=exit?'Exit wound':'Entry wound';mesh.renderOrder=3;mesh.frustumCulled=false;mesh.userData.wounds=true;
  const bary=new Triangle(hit.face.a,hit.face.b,hit.face.c).getBarycoord(hit.point,new Vector3())!;
  const center={mesh:hit.face.mesh,indices:hit.face.indices,bary};
  this.marks.push({shotId,kind:exit?'exit':'entry',mesh,anchors,center,sourcePart});this.group.add(mesh);
  while(this.marks.length>this.maxMarks){const old=this.marks.shift()!;this.remove(old)}
  return true;
 }
 destroyHead(center:Vector3){for(let i=this.marks.length-1;i>=0;i--)if(this.marks[i].sourcePart==='Head'){this.remove(this.marks[i]);this.marks.splice(i,1)}this.surface.destroyHead(center)}
 /** World-space center, useful for diagnostics and skinning acceptance checks. */
 markCenter(index:number){const mark=this.marks[index];if(!mark)return null;return this.anchorPosition(mark.center).position}
 private anchorPosition(anchor:Anchor,cache?:Map<SurfaceMesh,Map<number,Vector3>>){
  const at=(index:number)=>{if(!cache)return vertex(anchor.mesh,index);let vertices=cache.get(anchor.mesh);if(!vertices){vertices=new Map();cache.set(anchor.mesh,vertices)}if(!vertices.has(index))vertices.set(index,vertex(anchor.mesh,index));return vertices.get(index)!};
  const a=at(anchor.indices[0]),b=at(anchor.indices[1]),c=at(anchor.indices[2]);
  const position=a.clone().multiplyScalar(anchor.bary.x).addScaledVector(b,anchor.bary.y).addScaledVector(c,anchor.bary.z),normal=new Triangle(a,b,c).getNormal(new Vector3());return {position,normal};
 }
 update(){
  for(let i=this.channels.length-1;i>=0;i--){const c=this.channels[i];if(!this.marks.includes(c.entry)||!this.marks.includes(c.exit)){this.group.remove(c.mesh);c.mesh.geometry.dispose();(c.mesh.material as MeshStandardMaterial).dispose();this.channels.splice(i,1)}}
  if(!this.marks.length){this.surface.setCount(0);return;}
  this.prepare();this.group.updateMatrixWorld(true);this.inverse.copy(this.group.matrixWorld).invert();this.normalRotation.extractRotation(this.inverse);
  for(const [mesh,vertices] of this.samples)for(const [index,s] of vertices)vertex(mesh,index,s.position);
  for(const mark of this.marks){const positions=mark.mesh.geometry.getAttribute('position'),normals=mark.mesh.geometry.getAttribute('normal');
   for(let i=0;i<mark.anchors.length;i++){
    const anchor=mark.anchors[i],[a,b,c]=anchor.samples!,w=anchor.bary;
    this.normal.crossVectors(this.edgeA.subVectors(b.position,a.position),this.edgeB.subVectors(c.position,a.position)).normalize();
    this.point.copy(a.position).multiplyScalar(w.x).addScaledVector(b.position,w.y).addScaledVector(c.position,w.z).addScaledVector(this.normal,OFFSET).applyMatrix4(this.inverse);
    this.normal.transformDirection(this.normalRotation);positions.setXYZ(i,this.point.x,this.point.y,this.point.z);normals.setXYZ(i,this.normal.x,this.normal.y,this.normal.z);
   }positions.needsUpdate=true;normals.needsUpdate=true;
  }
  this.surface.setCount(this.channels.length);
  this.channels.slice(-16).forEach((c,i)=>{
   const entry=this.anchorPosition(c.entry.center).position,exit=this.anchorPosition(c.exit.center).position,axis=entry.clone().sub(exit),length=axis.length();
   this.surface.setHole(i,entry,exit,c.entryRadius,c.exitRadius);
   c.mesh.position.copy(entry).add(exit).multiplyScalar(.5).applyMatrix4(this.inverse);c.mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),axis.normalize());c.mesh.scale.set(1,length,1);
  });
 }

 reset(){for(const mark of this.marks)this.remove(mark);this.marks.length=0;this.seen.clear();for(const c of this.channels){c.mesh.geometry.dispose();(c.mesh.material as MeshStandardMaterial).dispose();this.group.remove(c.mesh)}this.channels.length=0;this.surface.setCount(0);this.surface.uniforms.destroyedRadius.value=0}
 dispose(){this.reset();this.surface.dispose();this.captureVertices.clear();this.captureFaces.length=0;this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.group.removeFromParent()}
}
