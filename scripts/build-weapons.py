"""Original LAST DRAW cosmetic weapon set. CC0-1.0.
Run: blender -b --python scripts/build-weapons.py
Exterior game-prop approximations only; no functional internal mechanisms.
Volcanic silhouette reference: NRA National Firearms Museum collection,
https://www.nramuseum.org/guns/the-galleries/the-american-west-1850-to-1900/case-20-colt-winchester/smith-wesson-volcanic-lever-action-pistol-(1).aspx
No reference image is copied or bundled. Game coordinates Y up, muzzle +Z.
All models share bore center (0,.025,.178) for existing physics/aim transforms.
"""
import bpy,math,pathlib,json
from mathutils import Vector
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'public/assets';OUT.mkdir(exist_ok=True,parents=True)
def P(v):return Vector((v[0],-v[2],v[1]))
def material(name,color,metal=0,rough=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=(*color,1);s.inputs['Metallic'].default_value=metal;s.inputs['Roughness'].default_value=rough;return m
blue=material('Deep blued steel',(.045,.065,.078),.92,.26)
silver=material('Satin machined nickel',(.43,.48,.50),.95,.24)
black=material('Recess and rubber',(.014,.018,.019),.05,.68)
brass=material('Antique engraved brass',(.46,.28,.082),.82,.31)
walnut=material('Rich oiled walnut',(.15,.047,.017),0,.39)
wear=material('Fine polished highlights',(.28,.31,.32),.92,.34)
MATS=[blue,silver,black,brass,walnut,wear]
def clear():
 for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
def finish(o,name,mat,bevel=0,smooth=True):
 o.name=name;o.data.materials.append(mat)
 if bevel:
  mod=o.modifiers.new('Rounded machined edge','BEVEL');mod.width=bevel;mod.segments=2;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 for p in o.data.polygons:p.use_smooth=smooth
 return o
def box(n,c,size,m,bevel=.001):
 bpy.ops.mesh.primitive_cube_add(size=1,location=P(c));o=bpy.context.object;o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,n,m,bevel)
def cylinder(n,c,r,length,m,axis=(0,0,1),segments=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=r,depth=length,location=P(c));o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(P(axis).normalized());return finish(o,n,m,.0003 if r>.004 else 0)
def mesh(n,vertices,faces,m,smooth=False,bevel=0):
 d=bpy.data.meshes.new(n);d.from_pydata([P(v) for v in vertices],[],faces);d.update();o=bpy.data.objects.new(n,d);bpy.context.collection.objects.link(o);return finish(o,n,m,bevel,smooth)
def curve(n,points,r,m,closed=False,resolution=4):
 d=bpy.data.curves.new(n,'CURVE');d.dimensions='3D';d.resolution_u=1;d.bevel_depth=r;d.bevel_resolution=1;sp=d.splines.new('POLY');sp.points.add(len(points)-1)
 for p,v in zip(sp.points,points):p.co=(*P(v),1)
 sp.use_cyclic_u=closed;o=bpy.data.objects.new(n,d);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.select_set(False);return finish(o,n,m,0,True)
def barrel(n,start=-.025,r=.015,octagon=False,mat=blue):
 count=8 if octagon else 48;v=[]
 for z,rr in [(start,r*1.10),(.170,r),(.178,r*.96),(.178,.0068),(.162,.0068)]:
  for i in range(count):
   a=2*math.pi*(i+.5)/count;v.append((rr*math.cos(a),.025+rr*math.sin(a),z))
 f=[]
 for j in range(4):
  for i in range(count):f.append((j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i))
 mesh(n,v,f,mat,smooth=not octagon)
 cylinder('Dark muzzle recess',(0,.025,.161),.0067,.001,black,segments=32)
 # Slight gleaming annulus at the muzzle does not obscure the actual bore.
 curve('Muzzle crown highlight',[(r*.96*math.cos(2*math.pi*i/48),.025+r*.96*math.sin(2*math.pi*i/48),.1782) for i in range(48)],.00035,wear,True)
def sights():
 box('Front sight blade',(0,.047,.160),(.0045,.015,.011),blue,.0004)
 box('Front sight silver bead',(0,.0538,.157),(.0025,.002,.0035),silver,.0003)
 for s in [-1,1]:box('Open rear notch',(s*.007,.056,-.103),(.004,.008,.011),blue,.0004)
 # Fine top grooves show the sightline rather than a wide solid block.
 for s in [-1,1]:curve('Rear notch edge',[(s*.0048,.059,-.108),(s*.0048,.059,-.099)],.0003,wear)
def screw(c,side,r=.003,m=silver):
 x,y,z=c;cylinder('Machined screw',(side*x,y,z),r,.0013,m,(1,0,0),20)
 box('Screw slot',(side*(x+.0008),y,z),(.0004,r*.24,r*1.3),black,.00008)
def scroll(side,x,y,z,scale=.008,m=wear):
 for sign in [-1,1]:
  pts=[]
  for k in range(25):
   a=k/24*math.pi*2.2;rr=scale*(1-k/31);pts.append((side*x,y+sign*rr*math.sin(a),z+sign*rr*math.cos(a)))
  curve('Fine decorative scroll',pts,.00022,m)
def cylinder_fluted(radius=.032,center_y=.012,front=-.026,back=-.092,darkmat=blue):
 count=144;v=[]
 for z,factor in [(back,0),(back+.004,1),(front-.004,1),(front,0)]:
  for i in range(count):
   a=2*math.pi*i/count;rr=radius-(max(0,math.cos(6*a))**6)*.0031*factor;v.append((rr*math.cos(a),center_y+rr*math.sin(a),z))
 f=[]
 for j in range(3):
  for i in range(count):f.append((j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i))
 f.extend([tuple(reversed(range(count))),tuple(3*count+i for i in range(count))]);mesh('Sculpted six-flute cylinder',v,f,darkmat,True)
 for i in range(6):
  a=2*math.pi*i/6;cylinder('Chamber face shadow',(.022*math.cos(a),center_y+.022*math.sin(a),front+.0005),.005,.001,black,segments=20)
  curve('Cylinder band highlight',[(radius*math.cos(a+k*.004),center_y+radius*math.sin(a+k*.004),front-.003) for k in range(-4,5)],.0003,wear)
 cylinder('Polished cylinder pin',(0,center_y,front+.002),.0045,.006,silver)
def inside(y,z,outline):
 hit=False
 for i,(a,b) in enumerate(outline):
  c,d=outline[(i+1)%len(outline)]
  if (b>z)!=(d>z) and y<(c-a)*(z-b)/(d-b)+a:hit=not hit
 return hit
def grip(rubber=False,brass_frame=False):
 # Rounded core and bevelled independent panels make a shaped backstrap.
 outline=[(-.015,-.113),(-.029,-.132),(-.084,-.128),(-.128,-.109),(-.132,-.079),(-.117,-.064),(-.056,-.075),(-.025,-.091)]
 verts=[]
 for x in [-.023,.023]:verts.extend((x,y,z) for y,z in outline)
 n=len(outline);faces=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]
 mesh('Curved metal backstrap',verts,faces,brass if brass_frame else silver,False,.002)
 panel=[(-.027,-.110),(-.039,-.124),(-.082,-.121),(-.121,-.104),(-.123,-.082),(-.112,-.072),(-.059,-.082),(-.038,-.095)]
 for s in [-1,1]:
  vv=[]
  for x in [s*.023,s*.026]:vv.extend((x,y,z) for y,z in panel)
  ff=[tuple(reversed(range(n))),tuple(n+i for i in range(n))]+[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]
  o=mesh('Rounded '+('rubber' if rubber else 'walnut')+' grip panel',vv,ff,black if rubber else walnut,False,.0012)
  # Cropped diagonal checkering with fine shallow geometry, not plastic stripes.
  for slope in [-.75,.75]:
   for k in range(-12,13):
    pts=[]
    for step in range(70):
     y=-.122+step*.0014;z=-.100+slope*(y+.073)+k*.0042
     if inside(y,z,panel):pts.append((s*.0273,y,z))
    if len(pts)>1:curve('Fine grip checkering',[pts[0],pts[-1]],.00015,wear if rubber else black)
  screw((.0274,-.070,-.101),s,.0034,brass if rubber else silver)
  # Small inset medallion and polished escutcheon.
  cylinder('Grip medallion',(s*.027,-.043,-.105),.0055,.0009,brass,(1,0,0),24)
  cylinder('Medallion inset',(s*.0276,-.043,-.105),.0039,.0003,blue,(1,0,0),20)
def trigger_guard(volcanic=False,magnum=False):
 if volcanic:
  curve('Volcanic lever bow',[(0,-.034+.024*math.cos(2*math.pi*i/60),-.059+.037*math.sin(2*math.pi*i/60)) for i in range(60)],.0028,blue,True)
  curve('Finger lever ring',[(0,-.061+.017*math.cos(2*math.pi*i/48),-.104+.017*math.sin(2*math.pi*i/48)) for i in range(48)],.0025,blue,True)
  curve('Lever heel',[(0,-.050,-.087),(0,-.066,-.085),(0,-.072,-.096)],.003,blue)
 else:curve('Oval trigger guard',[(0,-.035+.023*math.cos(2*math.pi*i/64),-.048+.028*math.sin(2*math.pi*i/64)) for i in range(64)],.003,silver if magnum else blue,True)
 curve('Curved trigger',[(0,-.012,-.048),(0,-.026,-.041),(0,-.039,-.044)],.0025,brass if volcanic else silver)
def standard():
 box('Rounded main frame',(0,.012,-.068),(.047,.062,.095),blue,.005)
 box('Cylinder window',(0,.012,-.056),(.049,.045,.065),black,.002)
 cylinder_fluted()
 box('Upper frame strap',(0,.050,-.055),(.025,.010,.112),blue,.0016)
 box('Lower cylinder bridge',(0,-.023,-.056),(.037,.013,.092),blue,.002)
 barrel('Long polished round barrel',r=.0145)
 cylinder('Ejector housing',(.014,.004,.066),.005,.185,blue)
 cylinder('Ejector cap',(.014,.004,.158),.0054,.004,silver)
 box('Hammer body',(0,.033,-.113),(.012,.029,.017),silver,.002)
 box('Serrated hammer spur',(0,.048,-.126),(.018,.006,.023),blue,.001)
 for j in range(5):box('Hammer serration',(0,.0513,-.135+j*.004),(.015,.0006,.001),wear,.0001)
 grip();trigger_guard();sights()
 for s in [-1,1]:
  for y,z in [(.022,-.112),(-.010,-.084),(-.012,-.029)]:screw((.0248,y,z),s)
  scroll(s,.0248,.022,-.105,.006)
  curve('Frame border inlay',[(s*.0245,-.013,-.097),(s*.0245,-.016,-.073),(s*.0245,-.014,-.032)],.0003,brass)
def volcanic():
 box('Rounded brass receiver',(0,.014,-.077),(.045,.065,.100),brass,.006)
 box('Receiver top blue spine',(0,.049,-.074),(.025,.010,.096),blue,.0015)
 barrel('Octagonal Volcanic barrel',start=-.029,r=.014,octagon=True)
 cylinder('Underbarrel visual magazine',(0,.003,.067),.0085,.206,blue)
 cylinder('Magazine end band',(0,.003,.163),.010,.009,brass)
 cylinder('Magazine receiver band',(0,.003,-.020),.011,.010,brass)
 box('Hammer body',(0,.035,-.119),(.012,.021,.015),blue,.002)
 box('Hammer checkered spur',(0,.045,-.130),(.017,.006,.022),wear,.001)
 grip(brass_frame=True);trigger_guard(True);sights()
 for s in [-1,1]:
  for y,z in [(.024,-.109),(.023,-.045),(-.006,-.096)]:screw((.023,y,z),s,.0028,blue)
  scroll(s,.0232,.012,-.073,.010,blue)
  curve('Brass engraved border',[(s*.0231,-.011,-.113),(s*.0231,-.014,-.072),(s*.0231,-.009,-.035)],.00035,wear)
  # Small decorative V, part of the original prop art.
  curve('Volcanic V mark',[(s*.0233,.038,-.085),(s*.0233,.027,-.077),(s*.0233,.038,-.069)],.0004,blue)
def magnum():
 box('Heavy nickel frame',(0,.008,-.069),(.053,.071,.104),silver,.004)
 box('Cylinder window',(0,.012,-.059),(.055,.049,.069),black,.002)
 cylinder_fluted(.0368,.012,-.023,-.096,blue)
 box('Heavy lower bridge',(0,-.027,-.060),(.042,.016,.100),silver,.003)
 box('Rear frame shoulder',(0,.047,-.094),(.040,.024,.043),silver,.003)
 barrel('Heavy target barrel',start=-.022,r=.020,mat=silver)
 box('Full barrel underlug',(0,-.003,.074),(.035,.027,.192),silver,.003)
 # Vented sight rib, authored as open gaps rather than painted rectangles.
 box('Rib lower rail',(0,.047,.073),(.011,.004,.187),blue,.0007)
 box('Rib upper rail',(0,.051,.071),(.012,.003,.184),silver,.0006)
 for z in [-.012,.036,.084,.132]:box('Vented rib support',(0,.049,z),(.010,.007,.008),silver,.0006)
 for s in [-1,1]:
  curve('Underlug bevel highlight',[(s*.0166,-.014,-.017),(s*.0166,-.014,.163)],.0004,wear)
  for z in [.015,.045,.075,.105,.135]:box('Barrel side vent',(s*.0187,.029,z),(.0007,.006,.016),black,.0005)
  screw((.028,.024,-.110),s,.0035)
  screw((.028,-.015,-.082),s,.003)
 box('Target hammer',(0,.034,-.121),(.018,.027,.020),blue,.002)
 for j in range(6):box('Hammer traction',(0,.0485,-.13+j*.004),(.016,.0007,.0011),wear,.0001)
 grip(True);trigger_guard(magnum=True);sights()

def export(name):
 for m in MATS:
  objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
  if not objects:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0]
  if len(objects)>1:bpy.ops.object.join()
  objects[0].name=name+' / '+m.name
 bpy.ops.object.select_all(action='DESELECT')
 for o in bpy.context.scene.objects:
  if o.type=='MESH':o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_animations=False)
 vv=[o.matrix_world@v.co for o in bpy.context.scene.objects if o.type=='MESH' for v in o.data.vertices]
 bounds=[[min(v[i] for v in vv),max(v[i] for v in vv)] for i in range(3)]
 tris=sum(len(p.vertices)-2 for o in bpy.context.scene.objects if o.type=='MESH' for p in o.data.polygons)
 stat={'name':name,'bytes':(OUT/(name+'.glb')).stat().st_size,'triangles':tris,'drawCalls':sum(o.type=='MESH' for o in bpy.context.scene.objects),'boundsGame':{'x':bounds[0],'y':bounds[2],'z':[-bounds[1][1],-bounds[1][0]]}}
 assert stat['triangles']<=25000,stat
 assert stat['drawCalls']<=6,stat
 assert stat['boundsGame']['x'][1]-stat['boundsGame']['x'][0]<=.081,stat
 return stat

def preview(name):
 bpy.ops.object.camera_add(location=P((.46,.20,.36)));cam=bpy.context.object;cam.rotation_euler=(P((0,-.024,.015))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.43;bpy.context.scene.camera=cam
 for pos,energy,size in [((.25,.38,.22),30,.38),((-.3,.16,.02),18,.3),((0,.10,-.35),16,.25)]:
  bpy.ops.object.light_add(type='AREA',location=P(pos));o=bpy.context.object;o.data.energy=energy;o.data.size=size;o.rotation_euler=(P((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=False;scene.world.color=(.12,.12,.12);scene.view_settings.view_transform='AgX';scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.render.filepath=str(ROOT.parent/(name+'11-preview.png'));bpy.ops.render.render(write_still=True)
 # Eye sits above the front sight; target is visible over, not through, the gun.
 before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(OUT/'cowboy.glb'))
 for o in set(bpy.context.scene.objects)-before:
  if o.parent is None:o.location+=P((0,-1.54,11.57))
 cam.data.type='PERSP';cam.data.sensor_fit='VERTICAL';cam.data.sensor_height=36;cam.data.lens=72.2;cam.location=P((0,.11,-.46));cam.rotation_euler=(P((0,.11,12))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.filepath=str(ROOT.parent/(name+'11-ads.png'));bpy.ops.render.render(write_still=True)

stats=[]
for name,build in [('revolver',standard),('volcanic',volcanic),('magnum',magnum)]:
 clear();build();stats.append(export(name));preview(name)
print('WEAPON_STATS_JSON',json.dumps(stats))
