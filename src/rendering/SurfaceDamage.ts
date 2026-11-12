import {Material,Mesh,MeshDepthMaterial,MeshDistanceMaterial,Object3D,RGBADepthPacking,Vector2,Vector3} from 'three';
const LIMIT=16;
const declarations=`varying vec3 vDamageWorld;
uniform vec3 damageStart[16];uniform vec3 damageEnd[16];uniform vec2 damageRadius[16];uniform int damageCount;
uniform vec3 destroyedHead;uniform float destroyedRadius;
`;
const cutting=`
 if(destroyedRadius>0.0&&distance(vDamageWorld,destroyedHead)<destroyedRadius)discard;
 for(int i=0;i<16;i++){
  if(i>=damageCount)break;
  vec3 axis=damageEnd[i]-damageStart[i];float length2=dot(axis,axis);
  float t=dot(vDamageWorld-damageStart[i],axis)/max(length2,0.000001);
  float radius=mix(damageRadius[i].x,damageRadius[i].y,clamp(t,0.0,1.0));
  vec3 radial=vDamageWorld-(damageStart[i]+axis*t);
  if(t>-.08&&t<1.08&&dot(radial,radial)<radius*radius)discard;
 }
`;
/** Shared world-space cut volumes: color, wound patches, shadow and distance passes. */
export class SurfaceDamage {
 uniforms={damageStart:{value:Array.from({length:LIMIT},()=>new Vector3())},damageEnd:{value:Array.from({length:LIMIT},()=>new Vector3())},damageRadius:{value:Array.from({length:LIMIT},()=>new Vector2())},damageCount:{value:0},destroyedHead:{value:new Vector3()},destroyedRadius:{value:0}};
 private owned:Material[]=[];private restores:(()=>void)[]=[];
 constructor(root:Object3D){root.traverse(o=>{if(!(o instanceof Mesh))return;
  const old=o.material,materials=(Array.isArray(old)?old:[old]).map(m=>{const c=m.clone();this.bind(c);this.owned.push(c);return c});o.material=Array.isArray(old)?materials:materials[0];
  const depth=o.customDepthMaterial,distance=o.customDistanceMaterial;
  o.customDepthMaterial=new MeshDepthMaterial({depthPacking:RGBADepthPacking});o.customDistanceMaterial=new MeshDistanceMaterial();this.bind(o.customDepthMaterial);this.bind(o.customDistanceMaterial);this.owned.push(o.customDepthMaterial,o.customDistanceMaterial);
  this.restores.push(()=>{o.material=old;o.customDepthMaterial=depth;o.customDistanceMaterial=distance});
 })}
 bind(material:Material){material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,this.uniforms);
  shader.vertexShader='varying vec3 vDamageWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvDamageWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=declarations+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+cutting);
 };material.customProgramCacheKey=()=> 'last-draw-surface-cut-v1';material.needsUpdate=true}
 setHole(index:number,start:Vector3,end:Vector3,entryRadius:number,exitRadius:number){if(index>=LIMIT)return;this.uniforms.damageStart.value[index].copy(start);this.uniforms.damageEnd.value[index].copy(end);this.uniforms.damageRadius.value[index].set(entryRadius,exitRadius)}
 setCount(count:number){this.uniforms.damageCount.value=Math.min(LIMIT,count)}
 destroyHead(center:Vector3,radius=.235){this.uniforms.destroyedHead.value.copy(center);this.uniforms.destroyedRadius.value=radius}
 /** Same predicate as shader, used by geometry acceptance checks. */
 cutAt(point:Vector3){
  if(this.uniforms.destroyedRadius.value>0&&point.distanceTo(this.uniforms.destroyedHead.value)<this.uniforms.destroyedRadius.value)return true;
  for(let i=0;i<this.uniforms.damageCount.value;i++){const a=this.uniforms.damageStart.value[i],axis=this.uniforms.damageEnd.value[i].clone().sub(a),t=point.clone().sub(a).dot(axis)/Math.max(1e-6,axis.lengthSq()),r=this.uniforms.damageRadius.value[i];if(t>-.08&&t<1.08&&point.distanceTo(a.clone().addScaledVector(axis,t))<r.x+(r.y-r.x)*Math.max(0,Math.min(1,t)))return true}return false;
 }
 dispose(){this.restores.forEach(f=>f());this.owned.forEach(m=>m.dispose());this.restores=[];this.owned=[]}
}
