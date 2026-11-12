import {BoxGeometry,SphereGeometry,BufferGeometry,Group,Matrix4,Mesh,MeshStandardMaterial} from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
/** Exact static 0.7 facades, merged by material and shadow flags. No gameplay colliders. */
export function createStreet(){
 const buckets=new Map<string,{geometry:BufferGeometry[];material:MeshStandardMaterial;cast:boolean;receive:boolean}>();let pieces=0;
 function add(g:BufferGeometry,p:[number,number,number],color:string,cast=false,receive=false,roughness=1,metalness=0){
  g.applyMatrix4(new Matrix4().makeTranslation(...p));const key=[color,cast,receive,roughness,metalness].join(':');
  if(!buckets.has(key))buckets.set(key,{geometry:[],material:new MeshStandardMaterial({color,roughness,metalness}),cast,receive});buckets.get(key)!.geometry.push(g);pieces++;
 }
 for(const s of [-1,1])for(const [index,z] of [-7,0,7,14].entries()){
  const x=s*6.4,front=x>0?-1:1;
  const box=(p:[number,number,number],size:[number,number,number],color:string,cast=false,receive=false,roughness=1)=>add(new BoxGeometry(...size),[x+p[0],p[1],z+p[2]],color,cast,receive,roughness);
  for(const side of [-1,1]){
   box([front*1.625,1.6,side*.95],[.035,.8,.62],'#263537',false,false,.3);
   for(const k of [-1,1])box([front*1.649,1.6,side*.95+k*.35],[.06,.93,.065],'#c2aa7f');
   box([front*1.649,1.6,side*.95],[.06,.045,.68],'#c2aa7f');
  }
  box([front*1.64,.92,0],[.06,1.8,.67],'#403126');
  add(new SphereGeometry(.028,8,6),[x+front*1.68,.95,z+.21],'#b19a65',false,false,1,.7);
  box([front*1.9,.1,0],[1.1,.18,4],'#67503a',false,true);
  box([0,1.65,0],[3.2,3.3,3.5],index%2?'#796044':'#8d7859',true,true);
  box([0,3.25,0],[3.5,.23,3.8],'#4a4033',true);
  for(let i=0;i<8;i++)box([front*1.61,.2+i*.4,0],[.025,.018,3.5],'#594935');
  box([front*1.9,2.4,.2],[1,.12,4.2],'#514331',true);
  for(const side of [-1,1])box([front*2.25,1.15,side*1.6],[.1,2.3,.1],'#4e4232',true);
 }
 const group=new Group();group.name='Static street';let triangles=0;
 for(const b of buckets.values()){
  const geometry=mergeGeometries(b.geometry)!;b.geometry.forEach(g=>g.dispose());geometry.computeBoundingSphere();
  triangles+=(geometry.index?.count??geometry.getAttribute('position').count)/3;const mesh=new Mesh(geometry,b.material);mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;group.add(mesh);
 }
 return {group,stats:{pieces,drawCalls:group.children.length,triangles},dispose(){for(const o of group.children){const m=o as Mesh;m.geometry.dispose();(m.material as MeshStandardMaterial).dispose()}group.clear()}};
}
