# Rocket Arena Reloaded (Rocket Ball)

A 3D rocket-car soccer game built with plain JavaScript and [Three.js](https://threejs.org) (r149). No build step, and no 3D model files: the cars, ball, pitch and goals are all made from basic shapes in code.

## Play locally
Open `index.html` in a browser. Three.js loads from a CDN. To play offline, save
[three.min.js (r149)](https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js) as `lib/three.min.js`.

## Put it on GitHub (and host it free)
1. Create a repository and upload everything in this folder.
2. Go to **Settings → Pages**, choose your main branch (root folder), and save.
3. Your game goes live at `https://<your-username>.github.io/<repo-name>/`.

## Controls
| Action | Keys |
| --- | --- |
| Throttle / reverse | W / S or ↑ / ↓ |
| Steer | A / D or ← / → |
| Jump, press again to flip | Space (hold a direction while pressing for a directional flip) |
| Boost | Shift |
| Chase cam / ball cam | C |
| Mute / unmute sound | M |
| Pick match size / bot level (menu) | 1 2 3 / 4 5 6, or click the buttons |
| Start / restart | Enter or click |

In the air, I/K pitch the nose and A/D turn. Under Settings → Flight control mode, choose Rocket-style Manual to use W/S for aerial pitch, or Assisted for W + Shift upward climbing. Boost always follows the car's nose.

## Rules
- Pick 1v1, 2v2 or 3v3 and Easy, Medium or Hard bots. In team modes you play with bot teammates who take chaser, support and goalie roles.
- Three-minute match, blue (you) against orange. A tie means sudden-death overtime.
- You attack the orange goal at the far end. Boost pads refill boost: large pads give 100, small pads give 30.

## Files
- `index.html`, `style.css`: page and HUD
- `game.js`: arena, physics, AI, camera (tuning constants are at the top)

## Ideas to add
Wall driving, instant replays, two-player split screen, car models (`.glb` via GLTFLoader), touch controls.

## Physics overhaul (November 2026)
- Ball contacts now distinguish a **rebound** from true rolling support, with bounded slip, rolling drag and spin aligned to curved ramps.
- Ramp-to-wall transfers redirect the ball's outward momentum upward without creating extra speed. High wall hits still rebound normally.
- Car/ball contacts include a small reciprocal sideways impulse for controlled aerial carries rather than sticky nose hits.
- Wall jumps preserve the original jump direction as the car rotates, allowing players to aim the nose and feather boost independently while airborne.
- Free Play → **Wall Air Dribble** is the repeatable practice drill. Use Space/A to detach, hold boost in bursts, and adjust pitch/air roll with the left stick and shoulder buttons.

Run local automated checks with `node tests/physics-smoke.js` and `node tests/wall-physics.test.js`. Browser gameplay is checked by `node tests/browser-smoke.js` when Chrome is installed.

## Keyboard aerial controls (November 2026)
W/S are **drive and reverse**, no longer full-time pitch controls. A/D steer and yaw, Space jumps/dodges, Shift boosts, Q/E air-roll, **K points the nose UP**, and **I points it DOWN**. During a jump, **W + Shift** now gently pitches toward a stable upward angle instead of continuously diving. Use K/I to override the assist for precise flight. Jump off the ground first; boost alone does not lift a grounded car.

## Ground traction and authentic-flight option
The ground solver now preserves *world-space momentum* through steering and applies side-slip damping as tyre traction. This creates a genuine difference between a grippy turn and low-grip powersliding, instead of moving the entire velocity vector instantly wherever the nose points. Wall and curved-ramp steering use the same model.

In **Settings → Keyboard aerial handling**, switch to **Rocket-style manual** for W/S nose pitch (W noses down, S noses up); it deliberately does not auto-level or auto-climb the car, so holding W + boost while airborne can dive just as pushing the stick forward can in Rocket League. **Assisted** retains the previous W + Shift upward flight so keyboard users can fly more easily. The choice is saved locally.

 
## Reloaded upgrade (November 2026)

This build adds a **configurable ball feel** independent of car handling. The new default, **Responsive**, preserves the reference mass and nominal gravity while adding livelier car-ball first contact, slightly brighter floor/ramp bounces, controlled ball lift and less rolling drag. **Classic** restores the original ball dynamics; **Airy** is tuned for aerial practice. The selection saves to the browser and applies to live ball physics as well as AI ball predictions.

The expanded 3D goal explosion garage has eight animated designs: **Classic Blast, Firestorm, Galaxy Rift, Lightning Storm, Black Hole, Supernova, Pixel Party and Aurora Pulse**. Click **Preview** to display the actual 3D goal effect in the garage before choosing it. Effects use short-lived lights, rings, glowing cores, styled particles and (on certain effects) 3D shards. Geometry and material resources are removed when each effect ends; no extra image assets required.

The garage now has three one-click routes: **Casual** (1v1, easy bots), **Competitive** (2v2, hard bots) and **Freestyle** (Free Play with wall-air-dribble drill). A real **MPH speedometer** appears during play, and the garage has updated visual styling. All original match, car, stadium, replay, multiplayer and training functionality is retained.

Tests: run `node tests/physics-smoke.js`, `node tests/wall-physics.test.js`, `node tests/ai-regression.test.js` and `node tests/browser-smoke.js`. The browser suite verifies every explosion preview and its resource cleanup, as well as saved ball-feel selection.

A dynamic ball-contact shadow and a compact 3D speed trail help you judge aerial height, the path of powerful shots and fast bounces. The trail uses a fixed 16-vertex GPU buffer rather than allocating particle geometry each frame. Goal explosions also play when you score in Free Play.
