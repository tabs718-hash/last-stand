"""Original LAST DRAW cosmetic game props, authored in code. CC0-1.0.
Run: blender -b --python scripts/build-props.py
Game coordinates: X right, Y up, +Z muzzle. No functional internal mechanism.
"""
import bpy, math, pathlib
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets'
OUT.mkdir(parents=True,exist_ok=True)
def p(v):return Vector((v[0],-v[2],v[1]))
def mat(name,color,metal=0,rough=.6):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough
 return m
steel=mat('Blued polished steel',(.105,.13,.15),.92,.28)
edge=mat('Wear on machined edges',(.35,.38,.39),.92,.3)
dark=mat('Recess shadow',(.012,.015,.016),.3,.68)
brass=mat('Aged brass',(.46,.31,.11),.8,.36)
wood=mat('Oiled walnut grip',(.13,.052,.026),0,.43)
felt=mat('Dusty umber felt',(.16,.105,.065),0,.95)
band=mat('Dark leather hatband',(.049,.028,.016),0,.66)
def finish(obj,name,m,bevel=0):
 obj.name=name;obj.data.materials.append(m)
 if bevel:
  mod=obj.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=3
  bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
 for poly in obj.data.polygons:poly.use_smooth=True
 return obj
def box(name,c,s,m,bevel=.001):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p(c));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m,bevel)
def cyl(name,c,r,d,m,axis=(0,0,1),verts=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=p(c));o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(p(axis).normalized());return finish(o,name,m,.0004 if r>.005 else 0)
def sphere(name,c,s,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=p(c));o=bpy.context.object;o.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,m)
def torus(name,c,major,minor,m,axis=(1,0,0),scale=(1,1,1)):
 bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=8,location=p(c),major_radius=major,minor_radius=minor);o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(p(axis).normalized());o.scale=scale;return finish(o,name,m)
def mesh(name,vs,faces,m):
 d=bpy.data.meshes.new(name);d.from_pydata([p(v) for v in vs],[],faces);d.update();o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);return finish(o,name,m)
def clear():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def export(name):
 # Batch static pieces by material to keep first-person/opponent draw calls low.
 groups={}
 for o in list(bpy.context.scene.objects):
  if o.type=='MESH':groups.setdefault(o.data.materials[0].name,[]).append(o)
 for material,objects in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0]
  if len(objects)>1:bpy.ops.object.join()
  objects[0].name=name+' / '+material
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',export_yup=True,export_apply=True,export_animations=False)
clear()
# External silhouette of an 1870s break-top revolver. Deliberately no working internals.
box('Frame lower bridge',(0,-.008,-.055),(.048,.016,.103),steel,.003)
box('Breech plate',(0,.021,-.096),(.049,.069,.014),steel,.003)
box('Top strap',(0,.055,-.044),(.026,.013,.118),steel,.002)
box('Top latch',(0,.065,-.085),(.025,.008,.024),edge,.001)
# Octagonal barrel with an actual dark muzzle recess.
n=8;vs=[]
for z,r in [(-.021,.016),(.174,.014),(.174,.006),(.158,.006)]:
 for i in range(n):
  a=2*math.pi*(i+.5)/n;vs.append((math.cos(a)*r,.029+math.sin(a)*r,z))
faces=[]
for ring in range(3):
 for i in range(n):faces.append((ring*n+i,ring*n+(i+1)%n,(ring+1)*n+(i+1)%n,(ring+1)*n+i))
mesh('Octagonal barrel and muzzle lip',vs,faces,steel)
cyl('Muzzle bore shadow',(0,.029,.159),.006,.001,dark)
cyl('Underbarrel ejector housing',(.012,.010,.073),.006,.19,steel)
box('Front sight',(0,.049,.16),(.005,.010,.012),edge,.0005)
box('Rear sight notch left',(-.008,.066,-.092),(.005,.006,.011),steel,.0005)
box('Rear sight notch right',(.008,.066,-.092),(.005,.006,.011),steel,.0005)
# Six flutes modelled in the cylinder surface rather than painted on.
n=144;vs=[]
for z in [-.089,-.086,-.029,-.026]:
 for i in range(n):
  a=2*math.pi*i/n;groove=max(0,math.cos(6*a))**7*.0035
  r=.032-(groove if z in [-.086,-.029] else 0)
  vs.append((math.cos(a)*r,.018+math.sin(a)*r,z))
faces=[]
for j in range(3):
 for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
faces.extend([tuple(reversed(range(n))),tuple(3*n+i for i in range(n))])
mesh('Fluted six-shot cylinder',vs,faces,edge)
for i in range(6):
 a=2*math.pi*i/6
 cyl('Chamber face recess %d'%i,(.021*math.cos(a),.018+.021*math.sin(a),-.0256),.0055,.001,dark)
cyl('Cylinder axle',(0,.018,-.024),.005,.005,steel)
# Walnut panels follow a curved, tapered grip with rounded palm edge.
vs=[];rings=[(-.018,-.103,.018,.022),(-.052,-.108,.022,.024),(-.113,-.094,.024,.028),(-.123,-.086,.021,.024)]
for y,z,rx,rz in rings:
 for i in range(24):
  a=2*math.pi*i/24;vs.append((rx*math.cos(a),y,z+rz*math.sin(a)))
faces=[]
for j in range(3):
 for i in range(24):faces.append((j*24+i,j*24+(i+1)%24,(j+1)*24+(i+1)%24,(j+1)*24+i))
faces.extend([tuple(reversed(range(24))),tuple(72+i for i in range(24))]);mesh('Carved walnut grip',vs,faces,wood)
# Fine grip grain is geometry, so export does not depend on Blender shader nodes.
for s in [-1,1]:
 for i in range(7):
  line=box('Walnut grain', (s*.0231,-.066-i*.006,-.094+i*.001),(.0005,.036,.0007),band,.0002)
 cyl('Grip screw',(s*.024,-.071,-.103),.004,.002,edge,(1,0,0),20)
 box('Screw slot',(s*.0252,-.071,-.103),(.0005,.001,.005),dark,.0001)
 for y,z in [(.024,-.098),(-.008,-.067)]:
  cyl('Frame screw',(s*.025,y,z),.003,.0015,edge,(1,0,0),20)
  box('Frame screw slot',(s*.0259,y,z),(.0004,.0008,.004),dark,0)
torus('Trigger guard',(0,-.042,-.033),.024,.003,steel,scale=(1,1.18,1))
box('Curved trigger',(0,-.030,-.039),(.006,.023,.006),edge,.002)
box('Hammer spur',(0,.065,-.109),(.013,.024,.019),steel,.002)
cyl('Break-top hinge',(0,-.005,-.016),.008,.056,edge,(1,0,0),24)
export('revolver')
# Camera-quality prop preview.
def render(path,target,location):
 bpy.ops.object.camera_add(location=p(location));cam=bpy.context.object;cam.rotation_euler=(p(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.47;bpy.context.scene.camera=cam
 bpy.ops.object.light_add(type='AREA',location=p((.3,.5,.3)));bpy.context.object.data.energy=35;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=.45
 bpy.ops.object.light_add(type='AREA',location=p((-.4,.2,-.1)));bpy.context.object.data.energy=20;bpy.context.object.data.size=.4
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.world.color=(.15,.15,.15);scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(path);scene.view_settings.view_transform='AgX';bpy.ops.render.render(write_still=True)
render(ROOT.parent/'revolver-preview.png',(0,-.025,.018),(.5,.18,.36))
clear()
# Curved brim and pinched crown, baked geometry and PBR materials.
n=96;vs=[]
for r,y in [(.075,-.006),(.12,-.007),(.18,0),(.18,.008),(.12,.002),(.075,.002)]:
 for i in range(n):
  a=2*math.pi*i/n;x=math.cos(a)*r;z=math.sin(a)*r*.93;lift=.025*(abs(math.cos(a))**6)*(r/.18)**3
  vs.append((x,y+lift,z))
faces=[]
for j in range(5):
 for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
mesh('Swept felt brim',vs,faces,felt)
vs=[]
for r,y in [(.098,0),(.098,.020),(.087,.075),(.076,.096),(.057,.099)]:
 for i in range(n):
  a=2*math.pi*i/n;pinch=1-.14*(max(0,math.sin(a))**4)*(y/.1)
  vs.append((math.cos(a)*r*pinch,y-.012*abs(math.sin(a))**4*(y/.1),math.sin(a)*r*.86))
faces=[]
for j in range(4):
 for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
faces.append(tuple(4*n+i for i in range(n)));mesh('Pinched crown',vs,faces,felt)
cyl('Leather hatband',(0,.015,0),.099,.018,band,(0,1,0),96)
box('Hatband brass keeper',(.097,.016,-.004),(.004,.015,.022),brass,.001)
# Physics hat body is centered 0.14 m above head; offset mesh to seat brim.
for o in bpy.context.scene.objects:
 if o.type=='MESH':o.location.z-=.055
export('hat')
render(ROOT.parent/'hat-preview.png',(0,.035,0),(.45,.35,.4))
print('Original CC0 cosmetic props exported:',[(f.name,f.stat().st_size) for f in OUT.glob('*.glb') if f.name in ['hat.glb','revolver.glb']])
