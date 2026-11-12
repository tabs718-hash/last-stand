"""Original CC0-1.0 cosmetic open-top leather holster for LAST DRAW.
Blender 4.3: blender -b --python scripts/build-holster.py
Game coordinates: Y up, +Z forward; local origin is the pocket body center.
No weapon mechanics or functional manufacturing specification is included.
"""
import bpy,math,os
from mathutils import Vector,Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def B(v):return Vector((v[0],-v[2],v[1]))
def mat(name,color,rough=.65,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
leather=mat('Oiled saddle leather',(.105,.043,.020),.58)
edge=mat('Leather edge and stitching',(.255,.139,.065),.78)
brass=mat('Worn brass',(.40,.285,.12),.34,.8)
def mesh(name,verts,faces,material):
 m=bpy.data.meshes.new(name);m.from_pydata([B(v) for v in verts],[],faces);m.update();m.materials.append(material);o=bpy.data.objects.new(name,m);bpy.context.collection.objects.link(o)
 for p in m.polygons:p.use_smooth=True
 return o
# Closed leather wall with a genuinely open cavity: outer and inner ring surfaces,
# stitched rim, closed bottom. Interior wall remains visible above the inserted gun.
rings=[(-.15,.020,.034),(-.13,.027,.037),(-.07,.034,.039),(0,.040,.040),(.07,.045,.040),(.14,.045,.040)]
n=48;vv=[]
for inside in [False,True]:
 for y,rx,rz in rings:
  for j in range(n):
   a=2*math.pi*j/n
   # A slightly higher back lip seats the belt-facing side of the frame.
   top=max(0,(y-.07)/.07)*max(0,-math.cos(a))*.018
   vv.append((math.sin(a)*(rx-(.0026 if inside else 0)),y+top+(.002 if inside and y<-.14 else 0),.018+math.cos(a)*(rz-(.0026 if inside else 0))+.024*max(0,math.cos(a))**6))
f=[];count=len(rings)*n
for k in range(len(rings)-1):
 for j in range(n):
  a=k*n+j;b=k*n+(j+1)%n;c=(k+1)*n+(j+1)%n;d=(k+1)*n+j
  f.append((a,b,c,d));f.append((count+d,count+c,count+b,count+a))
for j in range(n):
 a=(len(rings)-1)*n+j;b=(len(rings)-1)*n+(j+1)%n
 f.append((a,count+a,count+b,b))
 f.append((j,(j+1)%n,count+(j+1)%n,count+j))
f.append(tuple(range(n-1,-1,-1)));f.append(tuple(count+j for j in range(n)))
mesh('Open leather pocket',vv,f,leather)
def curve(name,points,r,material):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.resolution_u=2;c.bevel_depth=r;c.bevel_resolution=2
 sp=c.splines.new('POLY');sp.points.add(len(points)-1)
 for p,v in zip(sp.points,points):p.co=(*B(v),1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.data.materials.append(material);o.select_set(False);return o
# Rolled leather mouth piping follows the open pocket rather than covering it.
curve('Rolled open mouth',[(.045*math.sin(a),.14+max(0,-math.cos(a))*.018,.018+.040*math.cos(a)+.024*max(0,math.cos(a))**6) for a in [2*math.pi*j/n for j in range(n+1)]],.0018,edge)
# A narrow raised seam runs down the outward-facing side; short stitches follow it.
seam=[(.016,-.132,.048),(.026,-.09,.052),(.031,-.035,.056),(.035,.025,.058),(.037,.085,.058),(.036,.13,.058)]
curve('Outer seam',seam,.0014,edge)
for i in range(22):
 y=-.12+i*.0113;t=(y+.12)/.25;x=.021+.016*t;z=.050+.009*min(1,t*2)
 curve('Saddle stitch',[(x-.0018,y,z+.0009),(x+.0018,y+.004,z+.001)],.00065,edge)
def box(name,loc,size,material,bevel=.002):
 bpy.ops.mesh.primitive_cube_add(size=1,location=B(loc));o=bpy.context.object;o.name=name;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('Rounded leather edge','BEVEL');mod.width=bevel;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
# Rear belt strap rises above the open mouth but does not obstruct the grip.
box('Rear leather bridge',(0,.12,-.033),(.05,.08,.025),leather,.004)
box('Belt hanger',(0,.16,-.043),(.050,.128,.008),leather,.004)
box('Belt loop rear',(0,.195,-.058),(.046,.052,.008),leather,.004)
for s in [-1,1]:box('Belt loop side',(s*.021,.195,-.051),(.006,.052,.018),leather,.002)
# Small cosmetic buckle and retaining strap on the outer face below the opening.
strapverts=[]
for y in [.047,.069]:
 for j in range(33):
  a=-math.pi/2+math.pi*j/32;strapverts.append((.046*math.sin(a),y,.018+.041*math.cos(a)+.025*max(0,math.cos(a))**6))
strap=mesh('Curved keeper strap',strapverts,[(j,j+1,33+j+1,33+j) for j in range(32)],leather)
sol=strap.modifiers.new('Strap thickness','SOLIDIFY');sol.thickness=.002;bpy.context.view_layer.objects.active=strap;bpy.ops.object.modifier_apply(modifier=sol.name)
curve('Keeper buckle',[(-.011,.047,.090),(.011,.047,.090),(.011,.070,.090),(-.011,.070,.090),(-.011,.047,.090)],.0018,brass)
box('Buckle tongue',(0,.059,.092),(.018,.0025,.002),brass,.0005)
# Batch static pieces by material. Runtime can share the resulting geometry.
for material in [leather,edge,brass]:
 objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==material]
 if len(objects)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=ROOT+'/public/assets/holster.glb',export_format='GLB',use_selection=True,export_animations=False,export_yup=True)
# Offline fit preview with the already-shipped cosmetic gun.
before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=ROOT+'/public/assets/revolver.glb')
for o in set(bpy.context.scene.objects)-before:
 if o.parent is None:o.matrix_world=Matrix.Translation(Vector((0,0,.045)))@Matrix.Rotation(math.pi/2,4,'X')@o.matrix_world
floor=mat('Neutral preview ground',(.12,.105,.08),1)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.155));bpy.context.object.data.materials.append(floor)
bpy.ops.object.camera_add(location=(.65,-.9,.48));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.025))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.48;bpy.context.scene.camera=cam
for pos,power,size in [((1,-2,3),160,2),((-1,0,1),70,1),((0,2,2),130,2)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.data.energy=power;o.data.size=size;o.rotation_euler=(Vector((0,0,.02))-o.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.world.color=(.15,.15,.15);scene.render.resolution_x=700;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.filepath=ROOT+'/../holster07-preview.png';bpy.ops.render.render(write_still=True)
