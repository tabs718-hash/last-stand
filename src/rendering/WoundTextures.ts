import {DataTexture,RGBAFormat,UnsignedByteType,SRGBColorSpace,LinearFilter,LinearMipmapLinearFilter} from 'three';
export interface WoundTextures {color:DataTexture;normal:DataTexture;roughness:DataTexture;dispose:()=>void}
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
/** Original deterministic surface atlas. A recessed dark aperture, irregular absorbed
 * blood and a short run are baked together so the mark does not look like a red disk. */
interface Pixels {color:Uint8Array;normal:Uint8Array;roughness:Uint8Array}
const pixelCache=new Map<string,Pixels>();
function pixels(exit:boolean,size:number):Pixels {
 const key=exit+':'+size,cached=pixelCache.get(key);if(cached)return cached;
 const color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),roughness=new Uint8Array(size*size*4);
 const heights=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/(size-1),v=y/(size-1),dx=(u-.5)*.13,dy=(v-.62)*.16,a=Math.atan2(dy,dx);
  const grain=(Math.sin(x*1.81+Math.sin(y*1.37)*4)*Math.sin(y*2.23+x*1.17)+1)*.5;
  const outer=Math.sqrt((dx/(exit?.052:.042))**2+(dy/(exit?.044:.034))**2);
  const edge=1+.09*Math.sin(a*3+1)+.07*Math.sin(a*5+3)+.035*Math.sin(a*11);
  const stain=(1-smooth(edge-.13,edge,outer))*(.68+grain*.28);
  const runCenter=.0015+.0018*Math.sin(dy*85),runWidth=.0012+Math.max(0,dy+.075)*.023;
  const run=dy<-.009&&dy>-(exit?.085:.068)?1-smooth(runWidth*.5,runWidth,Math.abs(dx-runCenter)):0;
  const coreRadius=exit?.013:.0065,core=Math.sqrt(dx*dx+dy*dy)/coreRadius;
  const coreEdge=1+.065*Math.sin(a*3+2)+.045*Math.sin(a*7);
  const aperture=1-smooth(coreEdge-.12,coreEdge,core),rim=(1-smooth(coreEdge+.05,coreEdge+.23,core))*(1-aperture);
  const wet=(1-smooth(coreEdge+.15,coreEdge+.8,core))*(1-aperture-rim);
  const alpha=Math.max(stain,run*.92,aperture,rim);
  let r=83+grain*13,g=17+grain*8,b=13+grain*6;
  r=r*(1-wet)+64*wet;g=g*(1-wet)+11*wet;b=b*(1-wet)+8*wet;
  r=r*(1-rim)+74*rim;g=g*(1-rim)+37*rim;b=b*(1-rim)+20*rim;
  r=r*(1-aperture)+11*aperture;g=g*(1-aperture)+4*aperture;b=b*(1-aperture)+3*aperture;
  const i=(y*size+x)*4;color[i]=r;color[i+1]=g;color[i+2]=b;color[i+3]=Math.round(alpha*255);
  const rough=aperture*.94+rim*.86+wet*.36+Math.max(0,1-aperture-rim-wet)*.68;
  roughness[i]=roughness[i+1]=roughness[i+2]=Math.round(rough*255);roughness[i+3]=255;
  heights[y*size+x]=-.0014*aperture+.00028*rim;
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=(y*size+x)*4,ix0=y*size+Math.max(0,x-1),ix1=y*size+Math.min(size-1,x+1),iy0=Math.max(0,y-1)*size+x,iy1=Math.min(size-1,y+1)*size+x;
  let nx=-(heights[ix1]-heights[ix0])/(.26/(size-1)),ny=-(heights[iy1]-heights[iy0])/(.32/(size-1));const inv=1/Math.sqrt(nx*nx+ny*ny+1);nx*=inv;ny*=inv;
  normal[i]=Math.round((nx*.5+.5)*255);normal[i+1]=Math.round((ny*.5+.5)*255);normal[i+2]=Math.round((inv*.5+.5)*255);normal[i+3]=255;
 }
 const result={color,normal,roughness};pixelCache.set(key,result);if(pixelCache.size>4)pixelCache.delete(pixelCache.keys().next().value!);return result;
}
export function createWoundTextures(exit=false,size=256):WoundTextures {
 if(!Number.isInteger(size)||size<16||size>512)throw new RangeError('Wound atlas size must be 16–512');
 const {color,normal,roughness}=pixels(exit,size);
 const make=(bytes:Uint8Array,srgb=false)=>{const t=new DataTexture(bytes,size,size,RGBAFormat,UnsignedByteType);if(srgb)t.colorSpace=SRGBColorSpace;t.magFilter=LinearFilter;t.minFilter=LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;return t};
 const result={color:make(color,true),normal:make(normal),roughness:make(roughness),dispose(){this.color.dispose();this.normal.dispose();this.roughness.dispose()}};
 return result;
}
