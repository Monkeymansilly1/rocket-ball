# Rocket Arena 3D

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

In the air, W/S tilt the nose and A/D turn, so you can aim boost at the ball.

## Rules
- Pick 1v1, 2v2 or 3v3 and Easy, Medium or Hard bots. In team modes you play with bot teammates who take chaser, support and goalie roles.
- Three-minute match, blue (you) against orange. A tie means sudden-death overtime.
- You attack the orange goal at the far end. Boost pads refill boost: large pads give 100, small pads give 30.

## Files
- `index.html`, `style.css`: page and HUD
- `game.js`: arena, physics, AI, camera (tuning constants are at the top)

## Ideas to add
Wall driving, instant replays, two-player split screen, car models (`.glb` via GLTFLoader), touch controls.
