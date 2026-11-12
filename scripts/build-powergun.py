"""Original CC0-1.0 Power Gun exterior cosmetic game prop.
Blender: blender -b --python scripts/build-powergun.py
Reuses mesh primitives from build-weapons.py without running its three exports.
No real-world specifications, functional interiors or third-party art assets.
"""
import pathlib
source=pathlib.Path(__file__).with_name('build-weapons.py')
exec(compile(source.read_text().split('\nstats=[]')[0],str(source),'exec'),globals())

def powergun():
 # Fictional overbuilt six-shot frame: broad drum, squared shroud, copper inlays.
 box('Power Gun solid dark receiver',(0,.006,-.070),(.059,.078,.108),blue,.005)
 box('Power Gun cylinder cavity',(0,.012,-.057),(.061,.057,.080),black,.002)
 cylinder_fluted(.0398,.010,-.017,-.102,blue)
 box('Armoured upper strap',(0,.048,-.059),(.038,.014,.129),silver,.002)
 box('Reinforced lower frame',(0,-.029,-.063),(.048,.018,.107),blue,.003)
 box('Barrel shroud main',(0,.017,.078),(.052,.061,.191),blue,.004)
 # Open cosmetic crown and contrasting round bore make the silhouette legible.
 barrel('Power Gun recessed bore',start=-.020,r=.023,octagon=True,mat=silver)
 box('Massive underbarrel counterweight',(0,-.014,.070),(.044,.029,.183),blue,.004)
 for side in [-1,1]:
  box('Power Gun side plate',(side*.0268,.022,.063),(.0028,.032,.150),silver,.001)
  box('Copper power stripe',(side*.0286,.014,.063),(.0006,.004,.137),brass,.0002)
  for z in [.016,.044,.072,.100,.128]:
   box('Deep shroud vent',(side*.0288,.033,z),(.0007,.010,.014),black,.0005)
   box('Copper vent lip',(side*.0290,.0278,z),(.0005,.0012,.013),brass,.0002)
  screw((.0308,.030,-.115),side,.0037,brass)
  screw((.0308,-.020,-.093),side,.0034,silver)
  box('Power Gun rear cheek',(side*.030,.007,-.113),(.003,.045,.025),silver,.002)
  # Original geometric lightning emblem; purely exterior decoration.
  curve('Power Gun lightning insignia',[(side*.0322,.024,-.118),(side*.0322,.008,-.109),(side*.0322,.011,-.118),(side*.0322,-.009,-.108)],.0007,brass)
  curve('Drum perimeter band',[(side*.0401,.010+.031*math.sin(a),-.096+.001*math.cos(a)) for a in [i*math.pi/16 for i in range(33)]],.00035,wear)
 box('Low protected hammer',(0,.033,-.124),(.019,.027,.020),blue,.002)
 for z in [-.134,-.130,-.126,-.122]:box('Hammer grip serration',(0,.047,-.128+(z+.128)),(.017,.001,.0011),wear,.0001)
 grip(True);trigger_guard(magnum=True);sights()
 # Contrasting guard and a modest rear backstrap instead of a reused wooden grip.
 box('Power Gun grip heel',(0,-.130,-.094),(.053,.006,.036),blue,.002)
 for side in [-1,1]:
  curve('Copper grip inset',[(side*.028,-.048,-.116),(side*.028,-.083,-.114),(side*.028,-.116,-.099)],.00065,brass)

clear();powergun();stat=export('power-gun')
assert stat['boundsGame']['y'][1]<=.06001,stat
preview('power-gun')
(ROOT.parent/'power-gun11-preview.png').replace(ROOT.parent/'powergun-preview.png')
(ROOT.parent/'power-gun11-ads.png').replace(ROOT.parent/'powergun-ads.png')
print('POWER_GUN_STATS_JSON',json.dumps(stat))
