# LAST DRAW 1.2 asset provenance

## Human base: MakeHuman Community — CC0 1.0

The anatomical head topology and UVs in `public/assets/cowboy.glb` derive from the official MakeHuman base mesh and core male morph targets. Source files are preserved in `assets/source/makehuman/`; their upstream notices remain intact. Full legal text: `assets/source/makehuman/LICENSE.ASSETS.md`.

Official upstream sources (retrieved 2026-11-12):

- https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj
- https://github.com/makehumancommunity/makehuman/tree/master/makehuman/data/targets/macrodetails
- https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.ASSETS.md
- https://www.makehumancommunity.org/about/license.html

Only the head region of the `body` surface and anatomical landmarks are used; helper and joint meshes are excluded from rendering. The build script applies core male morphs, retargets the surface, authors clothing/accessories/materials and creates a new physical skeleton and skin weights. No external skin texture or third-party user-contributed asset pack is bundled. MakeHuman application code is not included.

## Original visual props and modifications — CC0 1.0

The Schofield-style cosmetic revolver, hat, clothing additions, eyes, gloves, boots, material values and generated environment texture were authored for LAST DRAW. They are released under CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). They were not extracted from another game. The revolver is a game visual approximation, not a dimensionally accurate or functional mechanical model.

Reproducible generators: `scripts/build-props.py` and `scripts/build-cowboy.py` (Blender 4.3). GLBs contain geometry, skinning and material parameters, with no prerecorded animation clips. Blender is a build tool, not a runtime dependency.

Dependency licenses for Three.js, Rapier, React and Vite remain those of their respective packages.

## 0.6 opponent replacement

The clothed silhouette is rebuilt with original smoothed/remeshed volumes for adult male proportions, fitted waistcoat panels, boots and gloves. The anatomical head and UVs retain the same MakeHuman CC0 provenance. All 16 physical skeleton names/anchors are preserved. The model is 39,676 triangles, with no animation clips or bundled photographic textures. The generator writes offline front/side/three-quarter/raised-arm QA renders beside the project; those are not browser screenshots.

## 0.7 original holster and wound atlases — CC0 1.0

`public/assets/holster.glb` and `scripts/build-holster.py` contain original open-pocket leather geometry/materials (161,416 bytes,3,896 triangles,3 materials, no clips). Wound color/alpha, normal and roughness DataTexture atlases are mathematically authored locally by `src/rendering/WoundTextures.ts`; no photographs or external wound images are bundled. These original visual assets are released under CC0 1.0. The runtime wound patches derive surface anchors from the CC0-based cowboy mesh and are not separate third-party models.

1.0 retains the same original/CC0 art assets. Atlas pixel caching and static scenery batching change storage/rendering, not asset provenance.

## 1.1 original weapon meshes — CC0 1.0

`scripts/build-weapons.py` generates the replacement ordinary revolver (12,964 triangles), Volcanic-style cosmetic lever pistol (9,348 triangles), and large-frame Magnum (12,496 triangles). Original authored geometry and material parameters, no external photographs/textures or functional internal mechanism, no animation clips. All three use the shared game grip/muzzle frame and are released under CC0 1.0. The generators and shipped GLBs supersede the old common revolver appearance.

## 1.2 Power Gun and fracture art — CC0 1.0

`scripts/build-powergun.py` authors `public/assets/power-gun.glb` (14,120 triangles, 470,340 bytes, five materials, no animations) with the shared game muzzle/grip frame. It reuses only original primitive helpers from build-weapons.py and does not replace the previous models. Power Gun and the procedural irregular fragment meshes, cut-channel walls and modified blood effects are original CC0 cosmetic game assets; no external image/texture pack is included.
