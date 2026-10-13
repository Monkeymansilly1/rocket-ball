# Rocket Arena

A 2D rocket-car soccer game in plain HTML, CSS and JavaScript. No build step, no dependencies.

## Play locally
Open `index.html` in a browser.

## Put it on GitHub (and host it free)
1. Create a new repository on GitHub and upload everything in this folder.
2. In the repo go to **Settings → Pages**, set the source to your main branch (root folder), and save.
3. Your game goes live at `https://<your-username>.github.io/<repo-name>/`.

## Controls
| Action | Keys |
| --- | --- |
| Drive / rotate in air | A / D or ← / → |
| Jump, press again to flip | Space or ↑ |
| Boost | Shift or ↓ |
| Start / restart | Enter or tap |

## Rules
- Two-minute match, blue (you) vs orange (AI). Tied at time-up means sudden-death overtime.
- Boost pads on the ground refill your boost: small pads give 35, corner pads give 100.

## Files
- `index.html`: page shell
- `style.css`: layout
- `game.js`: physics, AI, rendering (tuning constants are at the top)

## Ideas to add
Two-player mode, wall driving, car-vs-car bumps, difficulty levels, sound effects, touch controls.
