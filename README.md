# Rocket Arena (Rocket Ball)

A 3D car-soccer game built with JavaScript and bundled Three.js r149. No package installation, build step, accounts or downloaded runtime assets are needed.

## Run locally

From the repository root, run `python3 -m http.server 8000`, then open the served game in your browser. All libraries, textures and the credited Octane model are included in the repository.

## The rebuilt arena and lobby

The live 3D stadium is the backdrop to four lobby sections: **Play**, **Garage**, **Goal FX** and **Arena**. Play a casual 1v1, competitive 2v2, custom 1v1/2v2/3v3, or Free Play. Custom match options expand when needed. Garage contains car bodies, paint and player identities; player-two customisation appears when local two-player is enabled.

Championship Dusk is the default stadium theme, with Day, Night, Winter and Sunset alternatives. The Arena section includes an orbiting stadium tour. The continuous rounded pitch and collision solver use the same surface function. Texture UVs follow world coordinates, so blue/orange markings stay at the correct goal and do not stretch over the rounded corners. Renderer and generated-texture colour settings use the API supported by the bundled Three.js version. Static stadium geometry is batched to reduce draw calls while preserving named and animated objects.

Ball physics options have been removed. All modes use the same ball response, including Free Play; old saved ball-feel preferences are ignored. Keyboard aerial assistance remains available under Settings → Keyboard aerial handling. The standard solver uses 650 UU/s² gravity, 0.6 floor/wall restitution, Bullet-style 0.03 damping, a 30:180 ball/car mass ratio, and friction that transfers surface slip into spin. Car touches use the relative-speed extra-hit curve and direction adjustment documented in [RocketSim](https://github.com/ZealanL/RocketSim/blob/main/src/Sim/Ball/Ball.cpp), without scripted boost/flip bonuses or upward pop. These are reference-based approximations in this custom solver, rather than an exact reproduction of Rocket League's engine.

## Moving 3D goal explosions

Select a celebration in **Goal FX** to watch it at the actual goal with a dedicated preview camera. The same model plays when you score, including in Free Play. Each effect has its own geometry and animation:

| Effect | Animation |
| --- | --- |
| Shockwave | Expanding dome and flying shard crown |
| Inferno Dragon | Sculpted dragon, moving jaw, flapping wings and fire breath |
| Galaxy Rift | Rotating wormhole, spiral arms and orbiting worlds |
| Thunderstrike | Storm cloud and flickering, branching 3D lightning |
| Singularity | Black event horizon, accretion disc and inward-spiralling debris |
| Supernova | Collapsing star, solar spikes and expanding blast shell |
| Voxel Victory | GOAL letters assemble from cubes, then scatter |
| Aurora Wings | Flowing ribbon wings and a rising, rotating crystal |

Effects last roughly 3–5 seconds, remain distinct at every graphics quality, and dispose their geometries and materials after finishing. Rapid previews replace previous previews instead of accumulating GPU resources. Match goal celebrations finish before the replay begins.

## Controls and rules

- **Drive:** W/S or arrows; **steer:** A/D; **jump/dodge:** Space; **boost:** Left Shift; **drift:** E; **air roll:** Q/E; **ball camera:** C; **pause:** P; **mute:** M.
- Assisted aerial mode uses K/I for nose up/down and W + Shift for assisted climb. Manual aerial mode uses W/S for pitch. Controls can be rebound in Settings.
- Controllers use the left stick to steer/pitch, triggers to drive/reverse, A/✕ to jump, X/□ to boost, LB/L1 for drift/air roll and Y/△ for ball camera. A second controller enables local split screen.
- Matches last five minutes. A tie goes to sudden-death overtime. Large boost pads refill to 100; small pads add 12. Free Play provides unlimited boost and aerial, wall-dribble, save and kickoff drills.

## Validation

Run these commands from the repository root:

```sh
node --check game.js
node tests/physics-smoke.js
node tests/wall-physics.test.js
node tests/ai-regression.test.js
node tests/match-clock.test.js
node tests/goal-effects.test.js
node tests/scene-utils.test.js
node tests/browser-smoke.js
```

The browser suite requires system Chrome/Chromium and Node.js 22 or newer. `CHROME_BIN` can select a different installed Chrome executable. It starts its own local HTTP server and checks WebGL startup, the lobby, explosion selection and cleanup, the real arena geometry, Free Play, scoring, camera settings, kickoff and driving. The effects suite checks all eight animations at three quality levels and verifies resource disposal. The clock suite covers slow-frame timing and pause. CI runs these checks.

## Files and credits

- `game.js`: gameplay, arena, physics, AI and cameras.
- `index.html`, `style.css`, `lobby.css`: lobby, settings and match HUD.
- `lib/goal-effects.js`: original procedural 3D celebrations.
- `lib/scene-utils.js`: static stadium batching.
- `assets/octane/`: credited Octane model and textures; see [asset credits](assets/octane/CREDITS.txt).
- Three.js is distributed under its included [MIT licence](lib/THREE-LICENSE.txt).

This project uses original procedural arena and effect geometry. It is an independent car-soccer game.
