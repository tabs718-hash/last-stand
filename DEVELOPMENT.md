# LAST DRAW — 1.2.0 — physics duel

## Run

Requires Node 22+.

```sh
npm ci
npm run dev
npm test
npm run build
```

React / R3F / Three.js render the game. Rapier 0.19.3 is bundled locally, including WASM. No proprietary animation technology or assets extracted from other games are used.

## Implemented

- 16 dynamic human segments (76.2 kg), 15 joints, a dynamic revolver (1.05 kg) and hat (0.25 kg).
- One fixed 120 Hz game tick, four shared physics/controller substeps at 480 Hz, 12 solver iterations. Rendering interpolates transforms; focus loss pauses the duel.
- Quaternion PD muscles: inertia-based damping, finite torque limits, target smoothing, activation and local injuries. Bounded arm gravity compensation includes the carried weapon. Muscles apply equal/opposite torque to connected bodies. No pelvis anchor, position teleportation, velocity cancellation or fall animation.
- Foot contact manifolds, load estimates, support polygon, mass-weighted COM and capture point. Bounded ankle/hip targets attempt to restore balance and transfer support. Limited lateral recovery steps use bounded joint-space IK and adopt a new stance. There is no general walking or get-up behavior.
- Native hinge limits and multi-axis anatomical limits. The latter use an isolated adapter to Rapier's public raw joint set because its pinned spherical-joint JS wrapper lacks a high-level setter.
- Rapier ray intersections plus exact oriented-box entry/exit and nested dense material geometry. A material-interval sweep handles overlapping colliders. Length-dependent energy losses, stops, exits and momentum-limited impulses replace penetration chance.
- Persistent local motor/support/grip injuries. A severe knee wound can produce a physical fall while the opponent stays conscious; the healthy hand retains function, and weapon retention depends on contact loads. Head injury suppresses control and releases gun/hat. Direct gun hits do not automatically damage the hand.
- Breakable grip checks hand function, projectile impulses and weapon contact loads. Weapon and adjacent hand/forearm proxies have unwanted self-collisions filtered; ground and other-body collisions remain.
- FPS duel at selectable 3/6/12/15/25 m (default 12 m), seeded 5–10 s wait, first-click 0.76 s draw, six rounds, 0.8 s shot cooldown, explicit empty-cylinder feedback and a 2.2 s reload (F); empty cylinders do not end combat. AI uses muscle-driven drawing, physical barrel aim and muzzle rays, with a 3 s first shot and 1.3 s repeat cadence when able to aim. Only death resolves the duel for either actor: one head hit or two separate torso hits. Limbs are never lethal; every leg hit removes support and causes a physical fall. Armed-arm hits always release a held gun; disarm does not resolve combat.
- A skinned GLB cowboy derived from the CC0 MakeHuman base, original Schofield-style visual prop and hat, PBR materials, street facades, shadows, simple smoke and synthesized shot/signal audio. See ASSET_LICENSES.md.

## Controls

**Laboratory:** Space = moderate chest impulse (25 N·s); strong impulse = 60 N·s. R resets, D toggles diagnostics, P pauses. Disable muscles to observe passive collapse. Front/profile views are diagnostic cameras.

**Duel:** select Дуэль, then start normally or use DEBUG to skip waiting. Mouse aims; first left click after signal draws; later clicks shoot. Hold right mouse to zoom. Escape releases pointer lock and pauses a live duel; P toggles pause. Cursor-position aiming is available if pointer lock is denied.

Diagnostics provide LOW/MEDIUM/HIGH energy, knee/hand/gun/head/torso tests through the shared damage system, colliders, joints, COM, capture point, support contacts/polygon, torque/functionality, grip/consciousness/AI states, entry/exit/stop coordinates and residual energy, render FPS and subsystem timings.

**Сохранить протокол теста** exports initial body descriptors, parameters, seed, timed commands, shot records and current state. It is a diagnostic report, not a mid-simulation restore facility.

## Validation

`npm test` executes physics, ballistics, damage, duel and controls/diagnostic suites. They cover 30-second standing, moderate recovery, overload and passive collapse, replay, real path length and energy accounting, overlapping materials, muzzle obstruction, distinct wound reactions, independent gun hits, disarm, head loss of control, draw delay/ammunition, AI cadence, actual hit-based victory/defeat and no automatic win from a leg wound.

Measured minimum standing pelvis height is about 0.965 m. Settled chest angular speed is below 0.004 rad/s. Moderate-impulse COM excursion is about 0.11 m with recovery in 0.4. Same-platform replay tolerance is 1e-5, without cross-platform bitwise guarantees. All bodies remain dynamic; the skeleton has no world anchor.

The build runs TypeScript checking and Vite bundling. The inlined Rapier WASM leads to a large-chunk advisory (compressed client about 1.15 MB). Browser QA is not available because the managed preview relay is absent. The user has authorized publishing this and subsequent completed updates to the existing private Site, and receiving the updated build for manual testing.

## Remaining scope

The visuals are stylized prototype assets, not final photorealistic art. Still absent: photographic skin/clothing textures, full walking/get-up, weapon pickup, additional opponent campaign, and final visual polish. The injury/penetration coefficients are game models, not anatomical or terminal-ballistics validation. Rapier world timing includes joint solving; solver-only cost is not separately observable through this wrapper.

## Changes in 0.3

- Player input is blocked and pending trigger commands are discarded on pause/focus loss. Shots use immutable click-time aim/muzzle snapshots, so movement and a click within one render interval do not reuse stale camera aim.
- Signal and shot sounds subscribe to simulation events rather than the 100 ms HUD polling timer. Keyboard shortcuts work after clicking ordinary buttons; editable inputs keep their normal keyboard handling.
- Debug overlays can be enabled independently. A complete 16-segment amber target skeleton is reconstructed from the filtered muscle targets with matching joint anchors, rooted at the current pelvis. It does not modify the simulation. The cyan boxes show actual physical bodies.
- Diagnostic playback supports 1×, 0.5× and 0.25× speed and one fixed 1/120 s tick while paused. Physics/controller dt remains unchanged. No accumulated hidden-tab time is replayed on resume.
- The WebGL canvas stays mounted when switching inspection views/modes. Old Rapier worlds are disposed after the renderer detaches their callbacks.
- Four new executable scenarios verify clock/visibility behavior, fresh aim and muzzle transforms, cancelled paused input plus immutable commands/events, and target-skeleton continuity without body mutation. Browser UI verification remains blocked by the private Site's sign-in gate in the agent browser; this is separate from the successful headless checks.

See TESTING.md for the manual checklist.

## Changes in 0.4 — physical behavior

- The contact-based support target accounts for local leg capacity. A weak right-knee wound transfers measured load toward the intact left leg; severe loss of function still permits physical collapse.
- Dynamic knee flexion, a free-arm brace and a weapon-protecting arm pose respond to actual balance/velocity. A body-state controller distinguishes standing, recovery, falling, grounded, passive and unconscious states.
- The recovery-step planner waits for contact-load evidence and selects the unloaded foot, preserving the currently loaded support. A bounded two-link IK solver changes hip/knee/ankle targets; no dynamic transforms are written. A step is recorded only after actual lift, displacement and renewed floor contact. After landing, a new reference posture and capture-point feedback support the changed stance. Disabling further steps preserves an already adopted stance.
- The balance request is distributed through supported-leg muscles as equal/opposite internal torques, with contact gating, injury scaling, task priority and finite per-joint limits. Hip/knee limits are 140/110 Nm before activation/injury scaling; ankle limit is 130 Nm. No world anchor or unlimited pelvis force is added.
- Grounded conscious bodies use reduced leg/trunk activation, left-arm support and world-directed right-arm muscle targets. AI fires only when its actual barrel is aligned. The reproducible supine scenario retains its physical grip and fires at about 3 s; a critical head injury disables this control. This is an initial grounded aiming behavior, not a universal recovery/get-up controller.
- Detached gun/hat masses no longer contribute to character COM. Grip-release reasons are visible. Diagnostic hit directions follow local body geometry, allowing head tests on a lying opponent through the same ballistics/damage path.
- Diagnostics include load per foot, knee response, body/arm state, step attempts/physical plants, measured clearance/travel and a purple planned landing/path. The ground scenario constructs a new world with supine initial conditions; it never teleports an existing live body.

### 0.4 acceptance measurements

The fixed seed 1 test with a 32 N·s rightward chest impulse produces a physical recovery step: about 4.6 cm sole clearance, 14 cm foot travel, renewed floor contact and a stable pelvis around 0.96 m with the revolver retained. The healthy support share rises from about 48% to 53.5% after a LOW knee hit. Strong 60 N·s impacts can still cause a physical fall. Removing the floor produces about 19.5 cm COM descent in 0.2 s. These are tested scenarios, not guarantees for arbitrary impulses, surfaces or poses.

Nine additional executable acceptance scenarios cover load transfer, physical stepping without transform writes, protective motion, overload, actual ground AI firing, unconscious ground control, free fall, injury-gated stepping and detached-prop COM. Together with the existing suites, the test command reports 29 passing scenarios when successful.

The agreed remaining roadmap is in ROADMAP.md. Versions 0.6 and 1.0 remain separate releases.

## Changes in 0.5 — visual skeleton and assets

- A skinned cowboy model replaces the segmented mannequin. Canonical bind transforms are captured before any supine initialization. A dedicated adapter maps interpolated rigid-body world poses to exported bone-local poses; all 16 bones remain driven by physics, with no animation clips.
- Original cosmetic Schofield-style revolver and hat GLBs are used for opponent and FPS views. The hat and gun still follow independent dynamic bodies after release. The GLBs contain no executable code or remote textures.
- The debug mannequin toggle allows direct comparison without resetting or changing the physics world. Materials and shared asset geometry are cached; cloned skeletons belong to their character instance.
- Street facades add windows, door hardware and wooden porches; deterministic sand texture adds surface variation. These peripheral buildings remain visual scenery outside the duel corridor, without new gameplay colliders.
- Reproducible Blender 4.3 generators: `blender -b --python scripts/build-props.py`, then `blender -b --python scripts/build-cowboy.py`. Offline preview renders are written beside the project. Source data and full CC0 notice are included.
- Five asset checks supplement the 29 existing scenarios: normalized weights/no clips, standing and supine dynamic binding, and scales of both props. Browser rendering, pointer lock and performance still require the manual checklist; offline renders are not browser screenshots.

## Changes in 0.6 — complete-duel polish and opponent replacement

- Replaced the thin opponent model within this release. The new clothed adult silhouette has a fuller chest/waist/hips, thicker arms and thighs, enlarged head, continuous rounded shirt/trousers, shaped leather boots, gloved fingers and fitted V-neck waistcoat panels. The final GLB has 39,676 triangles, 16 physical bones and no animation clips. Front, side, three-quarter and raised-arm Blender renders were inspected. It remains stylized game art, not photorealistic skin/textiles.
- The original mechanical contact proxies/masses/inertia still drive active ragdoll balance. Separate zero-density sensor hit volumes cover the broader clothed silhouette for ray queries. Diagnostics distinguish contact boxes and copper hit volumes. These are coarse gameplay boxes, not triangle-accurate skin collision; the shin depth retains the established knee-energy calibration. `fromCamera` uses registered ballistic colliders only.
- A shared pure weapon-pose calculation now supplies the rendered gun and click-time muzzle position. Smooth draw, a gradual ADS transition with reduced relative-mouse sensitivity, aligned ADS muzzle, and simulation-time recoil replace disconnected view transforms. Pause freezes recoil; clicks during cooldown/draw never produce shots.
- Early clicks display a wait warning without drawing or consuming ammunition. The HUD shows draw/cocking progress, readiness, empty cylinder and loaded rounds. AI remains physically aimed and injury constrained; it reports recovery/empty/finished states and cannot fire after a result. Falling alone still does not win.
- Both empty cylinders produce a stalemate after resolving the last shot. Victory, defeat and stalemate screens preserve reaction time, shots/hits, opponent shots and duration, with a clean standing-duel restart. Combat ends while physical aftermath can continue.
- Locally synthesized bell, draw, shot, dry-click and result cues, distinct near/distant shots, plus a persistent session sound toggle. Muzzle flash, smoke, short tracer and dust/metal-hit particles retain up to four recent shots using simulation time. Audio and cosmetic effects do not drive gameplay.
- Explicit opponent asset loading/error feedback and a versioned asset request prevent silently displaying an old/fallback model. Scenario reports use additive schema 2 fields for hit volumes, ammunition and result statistics.

Validation: `npm test` passes 40 scenario outputs (29 original, 5 asset/binding, 6 new duel/presentation/hit-volume checks). `npm run build` performs TypeScript and Vite production bundling. Browser pointer lock, sound output, visual effects and device performance require the manual checklist: the managed preview relay is unavailable. The native publishing result confirms hosting only. The client still has a large bundle due to inlined Rapier WASM; broad optimization and final acceptance remain the separate 1.0 release.

## Changes in 0.7 — visible wounds, physical holsters and readable aftermath

The user approved the reviewed wound treatment before integration. All changes ship together in 0.7; 1.0 remains a separate acceptance/optimization/stabilization release.

- Persistent entrance wounds with dark aperture, damaged cloth edge, normal/roughness detail, irregular blood stain and short run. Powerful-profile penetration also creates a larger exit mark. CPU-skinned triangle barycentric anchors keep each clipped patch attached to the actual deformed garment/skin during movement and falls. Accessory buttons/eyes are excluded. Entrance/exit selection uses the outer clothing surfaces, not an invisible inner layer. Maximum32 marks per opponent, disposed/reset with the visual world. The aperture is a surface depth illusion, not a cut-out body mesh.
- Shot-time body poses are recorded so shots fired before the GLB finishes loading can be replayed onto the correct surface without modifying physics. Mannequin comparison hides the avatar while retaining its marks.
- Three selectable gameplay profiles use the current revolver visual: RevolverI60J and RevolverII220J stop inside character tissue; Powerful540J passes through tissue with a capped material-energy budget. This is an explicit game policy implemented in penetration calculation, not merely suppressed exit graphics. Metal and scenery keep their material stopping behavior. Geometry-based energy loss and total projectile momentum accounting remain. Separate weapon meshes/campaign are still later scope.
- A new original CC0 leather holster GLB is mounted on the opponent's pelvis by a fixed joint. The weapon begins attached to the holster, not the hand. A bounded muscle-driven reach physically approaches the grip, then swaps the holster constraint for a hand constraint at the current pose. Extraction, raising and aiming occupy the three seconds to the first healthy AI shot. The hand/gun proxy overlap is filtered, avoiding artificial contact that blocks grasp. There are no live dynamic-body teleports during draw. A low-capacity hand cannot acquire the gun.
- Player holster/gun are dynamic props anchored to a kinematic FPS belt/hand frame. First LMB after signal moves the hand toward the pocket, transfers the gun constraint, extracts and raises it in the original0.76s draw. Firing waits for actual equipment readiness. The displayed gun and bullet muzzle use the same physical weapon body. FPS hand motion is kinematic presentation; the opponent remains the active ragdoll. V looks down at the player's holster/belt.
- Normal standing laboratory sessions also start holstered; an explicit draw button is available. The supine diagnostic scenario starts already holding the gun, as its label indicates. The older direct-Rig physics fixtures still exercise the handheld baseline.
- Combat wait reduced to random5–10s; training skip retained. Combat resolves immediately, stops inputs/shots and freezes result statistics. The result card is delayed5 simulation seconds, leaving the physical aftermath unobscured. Pause also pauses that delay. Laboratory gains a back inspection camera for exit-wound checks.
- Scenario report schema3 records penetration policy, shot-time body poses, draw/holster state, player equipment readiness and delayed-result visibility.

Validation: the complete test command includes54 scenario outputs:40 previous,6 wound geometry/atlas tests,8 new release acceptance tests. Actual physical draw measurements at seed1: handover about0.642s after signal, first healthy AI shot about3.017s, maximum gun travel about8mm per120Hz tick. Both stop profiles, through profile, delayed win/loss, pause, no live-gun transform writes, no simultaneous hand/holster weld, impaired hand, physical player draw, late asset replay, wounds following a real fall, and30-second holstered lab stance are checked. Offline Blender renders inspect the actual atlas/patch geometry and physical draw snapshots. Managed browser preview remains unavailable because its relay is absent: pointer lock, sound, viewport composition and device FPS require TESTING.md.

## Final release 1.0

See RELEASE_NOTES.md for the final scope, fixes and verification limits; PERFORMANCE.md records measured CPU improvements. `npm test` runs 61 scenario outputs. `npm run build` now also verifies the deferred physics import graph, version, generated chunk files and all four GLB assets, writing a release manifest with hashes to `dist/release.json`. `npm run benchmark` measures host CPU work; it does not claim browser FPS.

The startup shell loads before the separate physics/WASM chunk. Static street pieces are merged by material, HUD refreshes no longer reconcile the scene, unchanged/hidden poses skip skin/wound work, and immutable atlas pixels are reused across resets. Geometry/material ownership remains explicit and independently disposable. Transient model failures can be retried in place; diagnostics preserve aim and pause combat explicitly. Renderer failure stops and tears down the current session with a restart message.

Core 0.7 gameplay remains: 5–10 second signal wait, physical holster draw, two stop-in-body and one through-body profiles, persistent attached marks, immediate combat resolution plus 5-second delayed result. Final browser acceptance remains manual because the managed preview relay is unavailable. The UI build is 1.1; report this version with manual-test findings.

## 1.1 corrections

Three separate cosmetic meshes: ordinary revolver, Volcanic-style lever-action “Вулкан”, and large-frame Magnum. Shared grip/muzzle coordinates preserve the physical body and holster constraints. ADS uses a lower, farther weapon pose and a 35° FOV so the opponent chest/head remain visible above the sights.

Explicit VitalState is independent of local motor injury and projectile energy. The first anatomical impact of a projectile determines the game lethality zone; a through-shot crossing several torso proxies counts only once. A limb-first path remains nonlethal, including later tissue intersections. Local physical impulses and wounds still apply along the path. Arm flinch uses bounded internal muscle targets, never body transform writes. Leg wounds withdraw balance/recovery support and buckle the knees under bounded torque; gravity/contact produce the fall.

The FPS player uses a dynamic capsule with anatomical query sensors and camera attachment, rather than a second full 16-part visible ragdoll. A leg wound releases its upright rotation constraint and withdraws the extended leg support by shortening the capsule collider to the hip volume; projectile impulse, gravity and ground contact produce the drop without writing body transforms. Both actors share the same head/torso/limb lethality rule. F reloads a held gun in 2.2 seconds; the opponent reloads automatically. A dropped gun is not reacquired in this patch. If both actors are disarmed, the duel remains active until restart; it does not award a false victory.

1.1.1 adds pre-duel distance selection. It recreates the initial session with the selected player/equipment/camera origin; no live body teleports. Selection persists across restarts and mode changes for the current app session. Diagnostic reports include `duelDistance`.

## 1.2.0 — Power Gun, open wounds and directional reactions

Power Gun adds a fourth original mesh and a fictional 80,000 game-energy profile. Its through-body resistance budget deposits a significant fraction of that energy, instead of passing through with nearly no momentum transfer. Incoming momentum still bounds total applied projectile impulse. Focused tests compare the same aim point: Power Gun deposits over eight times the Magnum body impulse for arms, legs, torso and head. The existing mortality rule remains head=one, torso=two distinct shots; limb damage never awards a kill.

A Power Gun head hit creates one bounded pool of 18 dynamic fragments with gravity and ground contact, hides the intact head in color/shadow passes, disables its ballistic sensor and removes intact-head wound channels. The remaining original head contact proxy becomes a small-mass sensor scaffold for the existing physical skeleton. The fragments are stylized exterior/interior chunks, not an anatomical simulation.

Magnum and Power Gun use actual fragment-discard cut volumes through skin and all clothing layers in the rendered avatar. A tapered, open-ended red inner wall joins the entrance and larger exit. Wounds and channels follow the deformed surface via barycentric anchors. The 16-channel cap follows the 32-mark pool. Shadow/depth/distance passes use the same cuts. This is a visual opening; physical query boxes remain coarse, without simulation of repeated bullets threading an existing hole. Blood runs remain authored surface stains rather than fluid simulation.

Arm reflex targets derive from the real incoming impulse direction in the parent joint frame; the previous fixed forward swing is removed. Leg injury retains active balance and healthy-side muscle torque, gives the struck leg an impact/flex response, and progressively loses support during a brace attempt. No live body translation or rotation is used to create the fall. The FPS player's simpler capsule representation remains unchanged.

Browser preview relay is unavailable. Automated checks cover impulse direction/magnitude, stagger and fall timing, fragment lifetime/contact, channel anchors and shader injection in color/depth passes, but do not replace GPU/browser acceptance.
