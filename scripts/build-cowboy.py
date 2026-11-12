"""Blender 4.3: CC0 MakeHuman mesh, retargeted to the LAST DRAW physical skeleton.
Run: blender -b --python scripts/build-cowboy.py
No animation clips: runtime drives all 16 bones from rigid bodies.
"""
import bpy, math, json, os
from mathutils import Vector, Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC=ROOT+'/assets/source/makehuman/'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
verts=[];uv=[];faces=[];groups={};group=''
for line in open(SRC+'base.obj'):
 p=line.split()
 if not p:continue
 if p[0]=='v':verts.append(Vector(tuple(map(float,p[1:4]))))
 elif p[0]=='vt':uv.append(tuple(map(float,p[1:3])))
 elif p[0]=='g':group=p[1];groups.setdefault(group,set())
 elif p[0]=='f':
  f=[tuple(int(k)-1 if k else -1 for k in v.split('/')) for v in p[1:]]
  groups.setdefault(group,set()).update(x[0] for x in f)
  if group=='body':faces.append(f)
for filename,amount in [('male-young.target',.85),('male-old.target',.15),('male-body.target',1)]:
 for line in open(SRC+filename):
  p=line.split()
  if len(p)==4 and not p[0].startswith('#'):verts[int(p[0])]+=Vector(tuple(map(float,p[1:])))*amount

def landmark(n):
 ids=groups['joint-'+n];return sum((verts[i] for i in ids),Vector())/len(ids)
def V(x):return Vector(x)
def B(v):return Vector((v[0],-v[2],v[1]))
# name, parent, source endpoints, physical joint endpoints
segments=[]
def seg(n,parent,a,b,A,C,r=.095):segments.append(dict(name=n,parent=parent,a=landmark(a),b=landmark(b),A=V(A),B=V(C),r=r))
seg('Pelvis',None,'pelvis','spine-4',(0,.98,0),(0,1.08,0))
seg('Abdomen','Pelvis','spine-4','spine-2',(0,1.08,0),(0,1.25,0))
seg('Chest','Abdomen','spine-2','neck',(0,1.25,0),(0,1.52,0))
seg('Head','Chest','neck','head-2',(0,1.52,0),(0,1.775,0),.085)
for s,side,src in [(-1,'Left','r'),(1,'Right','l')]:
 seg(side+' thigh','Pelvis',src+'-upper-leg',src+'-knee',(s*.17,.90,0),(s*.17,.54,0),.082)
 seg(side+' shin',side+' thigh',src+'-knee',src+'-ankle',(s*.17,.54,0),(s*.17,.15,0),.083)
 seg(side+' foot',side+' shin',src+'-ankle',src+'-foot-2',(s*.17,.15,0),(s*.17,.075,.19),.085)
 seg(side+' upper arm','Chest',src+'-shoulder',src+'-elbow',(s*.26,1.45,0),(s*.32,1.15,0),.09)
 seg(side+' forearm',side+' upper arm',src+'-elbow',src+'-hand',(s*.32,1.15,0),(s*.32,.89,0),.09)
 seg(side+' hand',side+' forearm',src+'-hand',src+'-finger-3-1',(s*.32,.89,0),(s*.32,.77,.01),.085)
for d in segments:
 d['q']=(d['b']-d['a']).rotation_difference(d['B']-d['A'])

def weights(v):
 # Restrict influence to anatomical chains; nearest source segment with soft shared joints.
 candidates=[]
 for i,d in enumerate(segments):
  ab=d['b']-d['a'];t=max(0,min(1,(v-d['a']).dot(ab)/ab.length_squared));dist=(v-d['a']-ab*t).length
  candidates.append((dist,i))
 candidates.sort();nearest=candidates[0][0]
 chosen=[(i,math.exp(-((dist-nearest)/.38)**2)) for dist,i in candidates[:3] if dist<nearest+.65]
 total=sum(w for i,w in chosen)
 return [(i,w/total) for i,w in chosen]
def warp(v,ws):
 out=Vector()
 for i,w in ws:
  d=segments[i];ab=d['b']-d['a'];t=(v-d['a']).dot(ab)/ab.length_squared
  out+=(d['A']+(d['B']-d['A'])*t+d['q']@(v-d['a']-ab*t)*d['r'])*w
 return out

def mat(n,c,rough=.8,metal=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
skin=mat('Weathered skin',(.46,.265,.16),.65);shirt=mat('Dusty linen',(.43,.36,.24));pants=mat('Indigo twill',(.065,.09,.105));leather=mat('Oiled leather',(.085,.036,.018),.58);vest=mat('Tobacco suede',(.19,.105,.052));brass=mat('Aged brass',(.43,.28,.09),.38,.75);hair=mat('Dark brown hair',(.055,.029,.018));scarf=mat('Oxblood cotton',(.26,.037,.025));white=mat('Eye white',(.68,.63,.51),.3);iris=mat('Hazel iris',(.11,.125,.065),.3);black=mat('Pupil',(.007,.006,.004),.2)
materials=[skin,shirt,pants,vest,hair]
# Build only the render surface; MakeHuman helper geometry is never exported.
used=sorted(set(x[0] for f in faces for x in f));remap={old:i for i,old in enumerate(used)}
ws=[weights(verts[i]) for i in used];positions=[warp(verts[i],w) for i,w in zip(used,ws)]
# Keep the licensed anatomical head; clothing supplies the covered silhouette.
positions=[warp(verts[i],[(3,1)]) for i in used]
for v in positions:v.x*=1.08;v.z*=1.03
ws=[[(3,1)] for i in used]
faces=[f for f in faces if all(positions[remap[x[0]]].y>1.505 for x in f)]
mesh=bpy.data.meshes.new('Continuous body');mesh.from_pydata([B(v) for v in positions],[],[[remap[x[0]] for x in f] for f in faces]);mesh.update()
obj=bpy.data.objects.new('Cowboy body',mesh);bpy.context.collection.objects.link(obj)
for m in materials:mesh.materials.append(m)
uvlayer=mesh.uv_layers.new(name='MakeHuman UV')
for poly,f in zip(mesh.polygons,faces):
 y=sum(positions[remap[x[0]]].y for x in f)/len(f)
 center=sum((positions[remap[x[0]]] for x in f),Vector())/len(f)
 names=[segments[max(ws[remap[x[0]]],key=lambda t:t[1])[0]]['name'] for x in f]
 poly.material_index=0 if names.count('Head')>len(f)/2 else 2 if all('thigh' in n or 'shin' in n or n=='Pelvis' for n in names) else 1

 if y>1.735 or (y>1.665 and center.z<-.012):poly.material_index=4
 poly.use_smooth=True
 for loop,x in zip(poly.loop_indices,f):uvlayer.data[loop].uv=uv[x[1]]
# Armature in canonical physics rest space.
bpy.ops.object.armature_add();arm=bpy.context.object;arm.name='PhysicalSkeleton';bpy.ops.object.mode_set(mode='EDIT');arm.data.edit_bones.remove(arm.data.edit_bones[0])
for d in segments:
 bone=arm.data.edit_bones.new(d['name'].replace(' ','_'));bone.head=B(d['A']);bone.tail=B(d['B'])
 if d['parent']:bone.parent=arm.data.edit_bones[d['parent'].replace(' ','_')]
bpy.ops.object.mode_set(mode='OBJECT')
def bind(o,weights_list=None,bone=None):
 o.parent=arm
 mod=o.modifiers.new('Physical deformation','ARMATURE');mod.object=arm
 if bone:
  o.vertex_groups.new(name=bone.replace(' ','_')).add(list(range(len(o.data.vertices))),1,'REPLACE')
 else:
  for i,d in enumerate(segments):
   g=o.vertex_groups.new(name=d['name'].replace(' ','_'))
   for vi,entries in enumerate(weights_list):
    for idx,w in entries:
     if idx==i:g.add([vi],w,'REPLACE')
bind(obj,ws)

def sphere(n,loc,scale,m,bone):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=B(loc));o=bpy.context.object;o.name=n;o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 bind(o,bone=bone);return o

def box(n,loc,scale,m,bone,bevel=.006):
 bpy.ops.mesh.primitive_cube_add(size=1,location=B(loc));o=bpy.context.object;o.name=n;o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Soft edges','BEVEL');mod.width=bevel;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 bind(o,bone=bone);return o
# Anatomical cloth volumes, fused and smoothed before skinning. These surfaces
# follow adult male measurements; bone anchors stay exactly as the physics rig.
def smoothstep(a,b,t):
 t=max(0,min(1,(t-a)/(b-a)));return t*t*(3-2*t)
def profile(name,rings,material):
 vv=[];ff=[]
 for y,rx,rz,zoff in rings:
  for j in range(48):
   a=2*math.pi*j/48;vv.append(B((rx*math.sin(a),y,zoff+rz*math.cos(a))))
 for k in range(len(rings)-1):
  for j in range(48):ff.append((k*48+j,k*48+(j+1)%48,(k+1)*48+(j+1)%48,(k+1)*48+j))
 ff.extend([tuple(range(47,-1,-1)),tuple((len(rings)-1)*48+j for j in range(48))])
 m=bpy.data.meshes.new(name);m.from_pydata(vv,[],ff);m.materials.append(material);m.update();o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o);return o

def raw_sphere(n,loc,scale,material,segments=24):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=16,location=B(loc));o=bpy.context.object;o.name=n;o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(material);return o

def capsule_volume(name,a,b,r1,r2,depth,material):
 # A single tapered cloth tube, not stacked sphere bands.
 vv=[];ff=[];a=Vector(a);b=Vector(b)
 for k in range(13):
  t=k/12;c=a.lerp(b,t);r=r1*(1-t)+r2*t
  # Small asymmetric cloth fold, below one millimetre at the silhouette.
  for j in range(32):
   angle=2*math.pi*j/32;fold=1+.008*math.sin(t*17+angle*3)
   vv.append(B((c.x+r*math.sin(angle)*fold,c.y,c.z+depth*(1-.13*t)*math.cos(angle)*fold)))
 for k in range(12):
  for j in range(32):ff.append((k*32+j,k*32+(j+1)%32,(k+1)*32+(j+1)%32,(k+1)*32+j))
 # Path descends, so reverse winding relative to rising torso rings.
 ff=[tuple(reversed(f)) for f in ff];ff.extend([tuple(range(32)),tuple(12*32+j for j in range(31,-1,-1))])
 m=bpy.data.meshes.new(name);m.from_pydata(vv,[],ff);m.materials.append(material);o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o)
 ends=[raw_sphere(name+' cap',a,(r1,r1,depth),material),raw_sphere(name+' cap',b,(r2,r2,depth*.87),material)]
 return [o]+ends

def fuse(objects,name,material,weightfn,voxel=.011):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
 # Smooth implicit union produces continuous armpits/hips with no detached tubes.
 rem=o.modifiers.new('Cloth surface union','REMESH');rem.mode='VOXEL';rem.voxel_size=voxel;rem.use_smooth_shade=True;bpy.ops.object.modifier_apply(modifier=rem.name)
 sm=o.modifiers.new('Cloth smoothing','SMOOTH');sm.factor=.7;sm.iterations=4;bpy.ops.object.modifier_apply(modifier=sm.name)
 dec=o.modifiers.new('Game mesh reduction','DECIMATE');dec.ratio=.16;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
 o.data.materials.clear();o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 # Very small broad folds in the cloth silhouette; no photographic texture claim.
 for v in o.data.vertices:
  x,z,y=v.co.x,-v.co.y,v.co.z
  wave=1+.008*math.sin(y*74+x*21)*math.sin(z*18+x*30)
  v.co.x*=wave;v.co.y*=wave
 bind(o,[weightfn(Vector((v.co.x,v.co.z,-v.co.y))) for v in o.data.vertices]);return o

idx={d['name']:i for i,d in enumerate(segments)}
def torso_weights(v):
 if v.y<1.08:return [(0,1)]
 if v.y<1.25:
  t=smoothstep(1.08,1.25,v.y);return [(1,1-t),(2,t)]
 return [(2,1)]
def shirt_weights(v):
 side='Left' if v.x<0 else 'Right';ui=idx[side+' upper arm'];fi=idx[side+' forearm']
 arm=smoothstep(.185,.275,abs(v.x))* (1-smoothstep(1.46,1.52,v.y))
 lower=1-smoothstep(1.10,1.20,v.y)
 out=[(i,w*(1-arm)) for i,w in torso_weights(v)]+[(ui,arm*(1-lower)),(fi,arm*lower)]
 return [(i,w) for i,w in out if w>.00001]
def trouser_weights(v):
 side='Left' if v.x<0 else 'Right';ti=idx[side+' thigh'];si=idx[side+' shin']
 hip=smoothstep(.84,.98,v.y);knee=1-smoothstep(.48,.60,v.y)
 return [(i,w) for i,w in [(0,hip),(ti,(1-hip)*(1-knee)),(si,(1-hip)*knee)] if w>.00001]

shirt_parts=[profile('Shirt trunk',[(1.02,.174,.117,0),(1.10,.176,.12,0),(1.22,.190,.125,0),(1.34,.215,.137,0),(1.42,.224,.129,-.002),(1.465,.224,.104,-.002),(1.51,.062,.069,0),(1.545,.060,.066,0)],shirt)]
for s in [-1,1]:
 shirt_parts.append(raw_sphere('Deltoid',(s*.253,1.426,0),(.072,.062,.075),shirt))
 shirt_parts+=capsule_volume('Upper sleeve',(s*.274,1.39,0),(s*.32,1.18,0),.076,.066,.078,shirt)
 shirt_parts+=capsule_volume('Forearm sleeve',(s*.32,1.15,0),(s*.32,.922,.002),.063,.052,.063,shirt)
shirt_obj=fuse(shirt_parts,'Linen shirt - continuous shoulders',shirt,shirt_weights,.0105)

pants_parts=[profile('Trouser pelvis',[(.865,.144,.102,-.003),(.91,.190,.123,-.005),(.99,.187,.124,0),(1.045,.174,.119,0)],pants)]
for s in [-1,1]:
 pants_parts.append(raw_sphere('Hip',(s*.095,.925,-.006),(.116,.105,.122),pants))
 pants_parts+=capsule_volume('Thigh cloth',(s*.14,.875,0),(s*.17,.58,0),.103,.085,.108,pants)
 pants_parts+=capsule_volume('Calf cloth',(s*.17,.55,0),(s*.17,.285,-.008),.080,.068,.083,pants)
pants_obj=fuse(pants_parts,'Denim trousers - continuous hips',pants,trouser_weights,.011)

# Fitted waistcoat panels: true curved V boundary rather than stepped face colors.
vrings=[(1.057,.180,.126),(1.10,.182,.127),(1.15,.188,.130),(1.20,.196,.135),(1.25,.203,.141),(1.30,.215,.147),(1.35,.225,.150),(1.40,.232,.145),(1.44,.233,.134),(1.465,.210,.113)]
vv=[];ff=[]
for s in [-1,1]:
 start=len(vv)
 for y,rx,rz in vrings:
  opening=.013+max(0,y-1.245)*.60
  first=math.asin(min(.96,opening/rx))
  last=math.pi/2-max(0,y-1.30)*2.5
  last=max(last,first+.08)
  for j in range(25):
   a=first+(last-first)*j/24;vv.append(B((s*rx*math.sin(a),y,rz*math.cos(a))))
 for k in range(len(vrings)-1):
  for j in range(24):
   f=(start+k*25+j,start+k*25+j+1,start+(k+1)*25+j+1,start+(k+1)*25+j)
   ff.append(f if s>0 else tuple(reversed(f)))
# Back panels follow the same body surface, with rounded armhole boundaries.
start=len(vv)
for y,rx,rz in vrings:
 trim=max(0,y-1.30)*2.5
 for j in range(33):
  a=math.pi/2+trim+(math.pi-2*trim)*j/32;vv.append(B((rx*math.sin(a),y,rz*math.cos(a))))
for k in range(len(vrings)-1):
 for j in range(32):ff.append((start+k*33+j,start+k*33+j+1,start+(k+1)*33+j+1,start+(k+1)*33+j))
m=bpy.data.meshes.new('Waistcoat fitted panels');m.from_pydata(vv,[],ff);m.materials.append(vest);o=bpy.data.objects.new('Suede waistcoat',m);bpy.context.collection.objects.link(o)
for p in m.polygons:p.use_smooth=True
sol=o.modifiers.new('Cloth thickness','SOLIDIFY');sol.thickness=.004;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=sol.name)
bind(o,[torso_weights(Vector((v.co.x,v.co.z,-v.co.y))) for v in o.data.vertices])

# Curved collars, seams, belt, fasteners and small hand details.
def curve_mesh(name,points,radius,material,bone):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2;c.bevel_depth=radius;c.bevel_resolution=2
 sp=c.splines.new('POLY');sp.points.add(len(points)-1)
 for p,v in zip(sp.points,points):p.co=(*B(v),1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.data.materials.append(material);bind(o,bone=bone);o.select_set(False);return o

def leather_tube(name,rings,material,bone):
 o=profile(name,[(y,rx,rz,z) for y,rx,rz,z in rings],material);bind(o,bone=bone)
 for p in o.data.polygons:p.use_smooth=True
 return o
leather_tube('Waist belt',[(1.015,.181,.129,0),(1.051,.179,.129,0)],leather,'Pelvis')
box('Brass belt buckle',(0,1.034,.137),(.048,.029,.008),brass,'Pelvis',.004)
for y in [1.12,1.20,1.28,1.36]:sphere('Waistcoat button',(.025,y,.145),(.0045,.0045,.003),brass,'Abdomen' if y<1.25 else 'Chest')
for s in [-1,1]:
 box('Pocket flap',(s*.112,1.218,.118),(.075,.022,.013),leather,'Abdomen',.007)
 curve_mesh('Pocket welt',[(s*.074,1.22,.126),(s*.151,1.22,.106)],.0025,brass,'Abdomen')
 # Broad collar leaves face free and covers the shared neck anchor.
 sphere('Shirt collar',(s*.038,1.507,.054),(.035,.024,.032),shirt,'Chest')
sphere('Neckerchief knot',(0,1.495,.079),(.022,.018,.018),scarf,'Chest')
box('Neckerchief fall',(0,1.448,.117),(.034,.075,.014),scarf,'Chest',.01)

for s,side in [(-1,'Left'),(1,'Right')]:
 # Rounded leather boots with shaped instep and shaft, then seam lines.
 bootparts=[raw_sphere('Boot toe',(s*.17,.065,.123),(.083,.055,.13),leather),raw_sphere('Boot instep',(s*.17,.105,.008),(.073,.095,.09),leather),profile('Boot shaft',[(.09,.073,.082,-.012),(.18,.078,.077,-.012),(.30,.081,.075,-.012),(.335,.085,.079,-.012)],leather)]
 # Move the centrally authored shaft to each leg before union.
 for v in bootparts[-1].data.vertices:v.co.x+=s*.17
 boot=fuse(bootparts,'Rounded boot '+side,leather,lambda v:[(idx[side+' foot'],1)],.009)
 # Reassign upper shaft to shin with smooth ankle transition.
 for g in list(boot.vertex_groups):boot.vertex_groups.remove(g)
 for bone in [side+' foot',side+' shin']:boot.vertex_groups.new(name=bone.replace(' ','_'))
 for v in boot.data.vertices:
  t=smoothstep(.13,.22,v.co.z);boot.vertex_groups[side.replace(' ','_')+'_foot'].add([v.index],1-t,'REPLACE');boot.vertex_groups[side.replace(' ','_')+'_shin'].add([v.index],t,'REPLACE')
 sole=raw_sphere('Leather sole',(s*.17,.022,.085),(.086,.018,.177),hair);bind(sole,bone=side+' foot')
 box('Boot heel',(s*.17,.024,-.045),(.13,.039,.095),hair,side+' foot',.015)
 curve_mesh('Boot toe seam',[(s*.17+.069*math.sin(j*math.pi/20),.082,.14+.085*math.cos(j*math.pi/20)) for j in range(-10,11)],.0018,vest,side+' foot')
 for q in [-1,1]:curve_mesh('Boot shaft stitch',[(s*.17+q*.069,y,-.055) for y in [.14,.19,.24,.29,.32]],.0015,vest,side+' shin')
 # Compact gloved palm with four finger forms rather than a featureless mitten.
 sphere('Gloved palm',(s*.32,.835,.004),(.047,.054,.034),leather,side+' hand')
 for j in range(4):
  x=s*.32+(j-1.5)*.019
  sphere('Glove finger',(x,.787+abs(j-1.5)*.003,.014),(.011,.031,.015),leather,side+' hand')
  curve_mesh('Finger stitch',[(x,.795,.028),(x,.815,.031),(x,.84,.032)],.0008,vest,side+' hand')
 sphere('Glove thumb',(s*.278,.835,.029),(.020,.032,.020),leather,side+' hand')
 leather_tube('Sleeve cuff',[(.895,.055,.057,.002),(.923,.057,.06,.002)],shirt,side+' forearm')
 # Cuff profiles are generated about origin; shift mesh to wrist X.
 cuff=bpy.context.scene.objects.get('Sleeve cuff')
 # Find the most recently created cuff even when Blender adds a numeric suffix.
 cuffs=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('Sleeve cuff')];cuff=cuffs[-1]
 for v in cuff.data.vertices:v.co.x+=s*.32

# Eye surfaces from MakeHuman anatomical helper bounds.
for side in ['l','r']:
 ids=groups['helper-'+side+'-eye'];vv=[verts[i] for i in ids];center=sum(vv,Vector())/len(vv);p=warp(center,[(3,1)]);p.x*=1.08
 sphere('Eyeball',p,(.012,.01,.011),white,'Head');sphere('Iris',p+Vector((0,0,.010)),(.0055,.0055,.002),iris,'Head');sphere('Pupil',p+Vector((0,0,.0115)),(.0025,.003,.001),black,'Head')
# Receding scalp hair is assigned directly on the anatomical head surface.
for s in [-1,1]:
 box('Sideburn',(s*.075,1.655,.006),(.014,.06,.026),hair,'Head',.004)
 sphere('Eyebrow',(s*.034,1.683,.083),(.022,.004,.004),hair,'Head')
 sphere('Moustache',(s*.017,1.602,.106),(.023,.008,.008),hair,'Head')
# Adult head proportion adjustment applies to every anatomical head accessory.
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 usedgroups={o.vertex_groups[g.group].name for v in o.data.vertices for g in v.groups if g.weight>.00001}
 if usedgroups=={'Head'}:
  for v in o.data.vertices:
   v.co.x*=1.12;v.co.y*=1.08;v.co.z=1.65+(v.co.z-1.65)*1.10
# Export only avatar objects, before importing separate hat for QA.
for material in [skin,shirt,pants,leather,vest,brass,hair,scarf,white,iris,black]:
 items=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==material]
 if len(items)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in items:o.select_set(True)
  bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join()
bpy.ops.object.select_all(action='DESELECT');arm.select_set(True)
for o in bpy.context.scene.objects:
 if o.type=='MESH':o.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/assets/cowboy.glb',export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
json.dump({d['name']:d['name'].replace(' ','_') for d in segments},open(ROOT+'/public/assets/rig-map.json','w'),indent=2)
# Offline proportion QA: front, side and three-quarter views.
if os.path.exists(ROOT+'/public/assets/hat.glb'):
 before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=ROOT+'/public/assets/hat.glb')
 for o in set(bpy.context.scene.objects)-before:
  if o.parent is None:o.location.z+=1.80
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.data.materials.append(mat('Sand',(.22,.19,.15)))
bpy.ops.object.camera_add();cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.0;bpy.context.scene.camera=cam
for pos,power,size in [((2,-3,4),240,3),((-2,-1,3),160,2),((0,3,3),320,2)]:
 bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=650;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.world.color=(.13,.13,.13);scene.view_settings.view_transform='AgX'
for label,pos in [('front',(0,-4,1.15)),('side',(4,0,1.15)),('threequarter',(2.2,-4.2,2.0))]:
 cam.location=pos;cam.rotation_euler=(Vector((0,0,.94))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=ROOT+'/../cowboy06-'+label+'.png';bpy.ops.render.render(write_still=True)

# Lifted weapon arm and flexed knee catch bind/weight problems before handoff.
upper=arm.pose.bones['Right_upper_arm'];anchor=arm.data.bones['Right_upper_arm'].head_local
upper.matrix=Matrix.Translation(anchor) @ Matrix.Rotation(math.radians(-75),4,'X') @ Matrix.Translation(-anchor) @ arm.data.bones['Right_upper_arm'].matrix_local
arm.pose.bones['Left_thigh'].rotation_mode='XYZ';arm.pose.bones['Left_thigh'].rotation_euler.x=math.radians(-8)
arm.pose.bones['Left_shin'].rotation_mode='XYZ';arm.pose.bones['Left_shin'].rotation_euler.x=math.radians(15)
bpy.context.view_layer.update()
cam.location=(2.2,-4.2,2.0);cam.rotation_euler=(Vector((0,0,.94))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=ROOT+'/../cowboy06-aiming.png';bpy.ops.render.render(write_still=True)
# Bind pose GLB was exported before posing, so no clips or changed rest matrices.
