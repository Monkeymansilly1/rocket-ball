# Rocket Arena (Rocket Ball)

A 3D car-soccer game built with JavaScript and bundled Three.js r149. No package installation, build step, accounts or downloaded runtime assets are needed.

## Run locally

From the repository root, run `python3 -m http.server 8000`, then open the served game in your browser. All runtime assets are bundled, including Octane and the supplied Fennec and Scorpion models.

## The rebuilt arena and lobby

The live 3D stadium is the backdrop to four lobby sections: **Play**, **Garage**, **Goal FX** and **Arena**. Play a casual 1v1, competitive 2v2, custom 1v1/2v2/3v3, or Free Play. Custom match options expand when needed. Garage offers exactly **Octane, Fennec and Scorpion**, with paint and player identities; player-two customisation appears when local two-player is enabled. Scorpion is selected on first use, and both players’ body choices persist after refresh. Its original mesh is bundled as a native Three.js model, so it appears even if the separate model or texture downloads fail; texture detail upgrades when available.

Championship Dusk is the default stadium theme, with Day, Night, Winter and Sunset alternatives. The Arena section includes an orbiting stadium tour. The continuous rounded pitch and collision solver use the same surface function. Texture UVs follow world coordinates, so blue/orange markings stay at the correct goal and do not stretch over the rounded corners. Renderer and generated-texture colour settings use the API supported by the bundled Three.js version. Static stadium geometry is batched to reduce draw calls while preserving named and animated objects. All 18 terrace rows contain 8,332 mini fans, spaced evenly along the stands. Performance mode keeps the full crowd with simpler bodies.

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

## Ball camera and movement

Ball cam preserves the original 105° FOV, existing speed/boost FOV response, and saved custom FOV values. There is no aspect-ratio FOV conversion. The competitive camera retains the updated 280 UU distance and 110 UU height. The orbit turns smoothly, retains its heading when the ball passes over the roof or bumper, and frames both the car and high balls. The camera follows the car's translation without boost lag, keeps a level horizon, and supports right-stick look with a smooth return to ball tracking. Camera height follows ramps, and wall orbits stay clear of the stands. Free Play tools collapse to a compact panel and the centre name badge is hidden during play to keep the ball-camera sightline clear. Saved camera settings are retained without automatic preset migration.

Normal tyre grip is firmer while powerslide keeps its lower grip. Sideways body contacts settle back onto the tyres; press Space to self-right a car resting on its roof, even if its aerial jumps were already used. Recovery requires body contact and cannot grant a mid-air jump. Visible-body bounds keep a tilted roof or flank above the pitch. Reverse acceleration stops at 1200 UU/s, braking stops at zero before reversing, analogue brake pressure changes deceleration, and existing boost momentum is preserved. Fixed-step physics can catch up through 250 ms render frames so movement no longer slows down at five FPS while the match clock keeps running.

Tilted aerial landings establish contact at the actual body clearance, then settle onto the tyres over a short suspension transition. This prevents nose-up or rolled cars from hovering above the upright contact height. Tyre-first impacts absorb downward speed without a roof bounce, preserve forward momentum, and allow another jump as soon as contact is established.

## Audio, replays and goal speed

The engine uses filtered combustion harmonics, a low engine layer, intake noise and a separate boost whoosh. Pitch, volume and boost changes fade smoothly; mute, volume and pause apply to all layers. Audio resumes from a user gesture when a browser suspends the audio context.

Replays record distinct states on the physics clock at 30 samples per simulation second, retaining up to ten seconds. Timestamp-based playback interpolates positions and full car/ball orientations, including wall driving, ceiling driving and aerial flips. Press Space or click Skip Replay to return to kickoff. The match clock stays frozen during playback.

Directional dodges use a 500 UU/s horizontal impulse and a smooth 0.65-second physical rotation. Holding the direction used to select the flip does not add another aerial rotation during it; opposite pitch cancels its pitch component. Landing ends the dodge immediately, and the visible car no longer runs a second cosmetic somersault. Assisted keyboard flight defers to manual rotation, body contact, recovery and inverted poses, stops pitching when boost is empty, and waits briefly after a dodge. Cars resting on their nose or tail can settle back onto their tyres while sliding. Camera and FOV behaviour are unchanged.

The bottom-left car speedometer has been removed. Goal speed is the ball's three-dimensional speed at the scoring-line crossing, converted using 50 Unreal units = 0.5 metres and the exact metres-per-mile conversion. It displays one decimal place and remains fixed through the celebration and replay. Free Play goal callouts also show the captured goal speed.

## Goal anthems

Goal FX includes **Custom Jump-up**, the user's uploaded DNB instrumental (about 16 seconds), **East Stand** (synthesized grime, 140 BPM), and **Touchline** (synthesized rap/hip-hop, 92 BPM). The upload's brief leading silence is removed and its playback volume is matched to the other songs. Select a clip, preview it, or choose Off. Settings has a separate goal-anthem volume slider; selection and volume survive refreshes. Game volume and M mute also apply to music.

The selected clip starts once when a match replay begins or a Free Play goal is scored, ducks engine/effect volume, resumes from its position after a pause, and fades out when the replay ends, is skipped, or the player returns to the garage. A skipped replay cancels pending downloads too. **Enable Sound**, available in Settings, the anthem panel, and the match toolbar when sound is blocked or muted, resumes browser audio and restores zeroed game/song volumes. Status text explains mute, volume, and browser audio blocks. Interrupted audio resumes on the next click or key press. There is no Spotify integration. See [audio credits](assets/anthems/CREDITS.md). Recreate the synthesized grime/rap files with `tools/compose-goal-anthems.py` (numpy, scipy and ffmpeg); this script preserves the uploaded DNB file.

## Private online 1v1

On **Play**, choose **Create Room**, then send the six-character code or **Copy Invite** link to a friend. Your friend opens the game and enters the code under **Join Room** (invite links fill it in). The match starts when both players connect: creator is Blue, friend is Orange, each uses their own keyboard/controller and selected car, with no bots or split screen. Either player can skip a goal replay. **Leave Match** closes the connection; create a new room to play again.

After typing a complete code, press **Join Room** or Enter. You can join a friend's room even if you already created one; joining closes your previous waiting room. Connection progress and errors appear above the room controls. Audio initialization failures do not block joining.

Room codes appear only once the creator registers with the signaling service. Both players generate their own temporary player IDs; joining does not depend on the public service's separate HTTP ID endpoint. Connection failures distinguish unsupported browsers, signaling failures, and player-to-player failures.

The creator's browser runs the shared physics, five-minute clock, score, boost pads, and replays. The friend's controls travel over a WebRTC data connection; host snapshots update the friend's view with smoothing. Input is cleared when stale and a lost connection returns players to the menu. Room codes expire when the creator leaves. Keep both game tabs open, particularly the host's. These are casual private matches; latency depends on both connections and the host's performance.

GitHub Pages serves the game unchanged. PeerJS 1.5.5 (bundled under MIT in `vendor/`, with its license) uses the public PeerJS signaling service and its default STUN/TURN servers, including TCP TURN fallbacks. No account or dedicated game server is required. Those public services must be reachable; restrictive networks or service outages can prevent joining, which the room status reports. Local/offline modes do not contact these services.

Room protocol checks: `node tests/online-rooms.test.js`. For a real two-browser WebRTC match test, run `npm ci --prefix tests/online` then `node tests/online-browser-smoke.js`. It runs a local signaling server. Environments that restrict direct UDP can supply a **local** TCP relay using `ROCKET_TEST_TURN_URL`, `ROCKET_TEST_TURN_USER`, and `ROCKET_TEST_TURN_PASSWORD`; browser network policies remain in force.

## Nexto opponents

Choose **NEXTO** on the Play menu for a 1v1, or select **Nexto** under Custom Match Options → Bots for 1v1, 2v2 or 3v3. The official trained Nexto policy runs locally in a Web Worker through a bundled WebAssembly runtime. The first match waits for the AI to load. Easy, Medium and Hard remain available. No server or external runtime download is required. `.nojekyll` keeps GitHub Pages in static-file mode so the bundled model and WebAssembly binaries are published directly.

This is an experimental adaptation to the game's custom physics, so it does not promise Nexto's Rocket League rank or playing strength. State coordinates, relative observations, the 90-action table, jump edges and 15 Hz decision rate match the upstream policy interface; car boost is consumed normally. A kickoff approach routine supports the learned policy, as upstream Nexto also uses a kickoff routine. Worker requests are bounded to one at a time, and stale predictions are discarded at kickoffs.

The Nexto model and adapted observation/action component are **CC BY-NC-SA 4.0**, separate from the project's MIT code. See [Nexto attribution and terms](assets/nexto/CREDITS.md). ONNX Runtime Web is MIT licensed with its notices in `lib/nexto/vendor/`. `tools/export-nexto.py` reproduces the conversion and verifies logits against the official TorchScript model. `tools/nexto-observation-fixture.py` checks the adapter against the official observation builder.

## Controls and rules

- **Drive:** W/S or arrows; **steer:** A/D; **jump/dodge:** Space; **boost:** Left Shift; **drift:** E; **air roll:** Q/E; **ball camera:** C; **pause:** P; **mute:** M.
- Assisted aerial mode: hold Space to jump, then hold Shift to pitch upward and climb (W is optional). K/I override nose up/down; Q/E air-roll. Manual aerial mode uses W/S for pitch. Controls can be rebound in Settings.
- Controllers use the left stick to steer/pitch, triggers to drive/reverse, A/✕ to jump, X/□ to boost, LB/L1 for drift/air roll and Y/△ for ball camera. A second controller enables local split screen.
- Matches last five minutes. A tie goes to sudden-death overtime. Large boost pads refill to 100; small pads add 12. Free Play provides unlimited boost and aerial, wall-dribble, save and kickoff drills.

## Validation

Run these commands from the repository root:

```sh
node --check game.js
node tests/physics-smoke.js
node tests/wall-physics.test.js
node tests/ai-regression.test.js
node tests/nexto.test.js
node tests/match-clock.test.js
node tests/aerial-controls.test.js
node tests/flip-physics.test.js
node tests/replay.test.js
node tests/car-audio.test.js
node tests/goal-anthems.test.js
node tests/ball-camera.test.js
node tests/car-recovery.test.js
node tests/landing.test.js
node tests/mini-crowd.test.js
node tests/scorpion-body.test.js
node tests/goal-effects.test.js
node tests/scene-utils.test.js
node tests/browser-smoke.js
```

The browser suite requires system Chrome/Chromium and Node.js 22 or newer. `CHROME_BIN` can select a different installed Chrome executable. It starts its own local HTTP server and checks WebGL startup, the lobby, explosion selection and cleanup, the real arena geometry, Free Play, scoring, camera settings, kickoff and driving. The effects suite checks all eight animations at three quality levels and verifies resource disposal. The clock suite covers slow-frame timing and pause. The aerial suite starts a car on its wheels and verifies assisted and manual takeoffs. Text fields accept bound keys normally; starting play or leaving the tab clears held keyboard input. CI runs these checks.

## Files and credits

- `game.js`: gameplay, arena, physics, AI and cameras.
- `index.html`, `style.css`, `lobby.css`: lobby, settings and match HUD.
- `lib/goal-effects.js`: original procedural 3D celebrations.
- `lib/scene-utils.js`: static stadium batching.
- `lib/replay.js`, `lib/car-audio.js`: replay sampling, speed conversion and layered engine audio.
- `lib/ball-camera.js`: stable ball/chase camera rig with the original FOV behaviour.
- `assets/octane/`: credited Octane model and textures; see [asset credits](assets/octane/CREDITS.txt).
- `assets/fennec/`, `assets/scorpion/`: models supplied by the project owner, converted to web assets with four wheel pivots. Scorpion uses external glTF geometry and resized texture maps for reliable loading. Fennec retains its materials; its three external normal maps were absent from the FBX.
- `tools/convert-car-assets.py`: Blender conversion script for the supplied FBX files.
- Three.js is distributed under its included [MIT licence](lib/THREE-LICENSE.txt).

This project uses original procedural arena and effect geometry. It is an independent car-soccer game.
