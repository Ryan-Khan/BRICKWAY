# BRICKWAY Formula car nose and number plate

Release `2026.11.28-f1-nose-and-number-plate` builds on the uploaded `index.html` tagged `v0.218-car-19-turn-1-trial`. Serve `index.html`, `manifest.webmanifest`, and `brickway-icon.svg` together. No new assets or dependencies are added.

## Changes

The Formula car has a longer nose, so there is more room between the cockpit and the front wing. The race number returns to a flat plate on top of the nose and is drawn as a bold pixel number. The previous wedge-shaped mount under the plate is removed.

The change is in `buildFormulaCar`, so the player car and all AI rivals share it. One constant, `FORMULA_NOSE_EXTEND`, sets the extra nose length. It is 1.6 world units. Set it to 0 to restore the previous proportions.

## Car geometry

Everything ahead of the cockpit moves forward by `FORMULA_NOSE_EXTEND`. The cockpit, sidepods, driver and rear wing stay where they were.

| Part | Before | After |
| ---- | ------ | ----- |
| Floor | 15.0 long, centred on 0 | 16.6 long, front edge 1.6 further forward |
| Nose cone | 6 blocks from z -7.00 to -2.45, 0.91 apart | 6 blocks from z -8.60 to -2.45, 1.23 apart, each block deepened to stay joined |
| Front wing, accent and endplates | z -7.72, -7.47, -7.60 | z -9.32, -9.07, -9.20 |
| Headlamps | z -8.42 and -8.514 | z -10.02 and -10.114 |
| Front tyres and axle arms | z -5.18 | z -6.78 |
| Wheelbase (front to rear tyres) | 10.30 | 11.90 |
| Headlight beams and light pool | z -8.58, pool at -28.55 | z -10.18, pool at -30.15 |
| Pit crew, front pair | z -5.43 | z -7.03 |

Rear tyres, rear wing, sidepods, halo and driver keep their positions. Pit wheel positions are read from the car's own tyres, so the wheel swap follows the longer wheelbase. The pit-box crew positions are set in the pit box, so the front pair was moved by the same amount.

## Number plate

The plate is a flat 1.55 × 0.78 plane at x 0, y 2.12, z -6.2. It sits just above the third nose block, clear of the blocks on either side. The mesh is named `race-number-<number>`.

The number is drawn on a 40 × 20 canvas from a hand-built 5 × 7 pixel font for the digits 0 to 9. Each font pixel is stretched to 4 × 2 canvas pixels, which thickens the strokes. A glyph is 12 × 14 canvas pixels with a 2 pixel gap between digits, and the text is centred, so 1, 2 and 3 digit numbers all fit. The texture uses nearest-neighbour magnification and minification with mipmaps off, so the pixels stay hard-edged at any camera distance. Colours are unchanged: dark ink `#141820` on the off-white plate `#f7f6ed`.

## Test report

The repository's Node tests were run from the repository root against the changed file:

```
BRICKWAY_HTML=./index.html node --test f1core.test.js presentation.test.js
```

| File under test | Tests | Passed | Failed |
| --------------- | ----- | ------ | ------ |
| `index.html` currently committed on `main` | 62 | 62 | 0 |
| Uploaded `v0.218-car-19-turn-1-trial`, before this change | 62 | 60 | 2 |
| Uploaded file with this change | 62 | 60 | 2 |

The two failures are `tyres and pit stops` and `the finish car slows before accelerating away, and the pass-by fills the final shot`. They fail identically on the uploaded file before this change, so they come from that trial build and not from the nose or plate. The finish-car test expects a 6.2 second finish shot and the trial build reports a different value. Resolve them before publishing this build.

The edited script parses with `node --check`. These checks were not run: `node competitive-regression.js`, `node competitive-regression.js --mobile`, and any visual check in a browser. The new nose proportions, plate position, pixel number and pit-stop alignment have not been looked at on screen.
