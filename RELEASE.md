# BRICKWAY V54 Grand Prix

Release `2026.11.25-f1-grand-prix-overhaul` builds on the uploaded LEGO Faces HTML at GitHub commit `9746f3e`. Serve `index.html`, `manifest.webmanifest`, and `brickway-icon.svg` together. The game loads Three.js 0.160.0 and its existing addons from jsDelivr.

## Changes and controls

Choose Grand Prix, qualifying followed by a race, or a five-round championship. Short runs 12 laps, Standard runs 20, and Long runs 30. Choose Dry, Damp, or Wet in setup. Intermediate and wet starting tyres appear for damp and wet races. Track conditions stay fixed for the session.

W accelerates, A/D steer, Shift boosts, and Space brakes in F1. On a phone, push the joystick forward to accelerate and use the brake pedal while steering. Select the next tyre on the race HUD and press P or Request Pit before the yellow entry. A second request cancels a queued stop. The game drives through the lane, stops for the crew, and releases control at the exit.

## Circuit and vehicle

The 35 control points in `F1Core.circuit` form a closed centripetal Catmull–Rom spline. The course measures 4,437.30 world units. Distances use the source coordinate scale of 2.15. The existing tyre centres sit at ±4.23, each tyre measures 1.03 across, and the model uses a 0.98 scale, giving an outer tyre span of about 9.3 units. The body extends about 17 units longitudinally.

The F1 road ribbon and timing profile use 720 equal arc-length intervals, about 6.16 units apart. The 36-unit ordinary surface widens to 45 in passing sections and 55 on the grid straight. The main straight ends in a right-hand hairpin. A second straight feeds a left-right chicane around 60% of the lap. A slower bend around 84% follows the technical sequence. Braking boards and DRS zones derive from sampled curvature. The pit road branches off late in the lap, outside the racing ribbon at the service box, and rejoins before the line.

Players and bots use the same acceleration, tyre-dependent brake and lateral-grip functions. Player steering has a filtered input and limited yaw rate. Bots use a curvature profile to plan braking and follow offset racing lines. Difficulty changes corner-entry margin and passing and defending decisions. Safety Car recovery speed depends on the queue gap only during neutralisation.

## Strategy and race control

Base dry wear per lap is 11.3% for soft, 7.7% for medium and 5.2% for hard. Wear accumulates with forward distance. Fresh softs provide the strongest dry grip. Worn tyres progressively reduce pace, braking and cornering. Damp and wet conditions change the relative grip of slicks, intermediates and wet tyres. AI personalities influence attacks, defence, wear and stop thresholds. Each car spends race time travelling the lane and receiving service.

Incidents can trigger a yellow flag, VSC, or Safety Car period. These disable DRS and new attacks. The Safety Car uses a reduced leader pace and a catch-up limit for the queue. It is implemented through race control and the HUD. Three distinct track-limit excursions add three seconds to classification. The HUD reports tyre condition, stops, flags, splits, best lap and estimated gaps. Live gaps use progress and a reference lap. Finished cars use elapsed time including penalties.

## Test report

All 49 F1Core tests passed. Headless Chrome on macOS used Metal and the game's pinned Three.js version. The race simulations exercised the actual race update loop with five AI cars and a scripted player trajectory.

| Laps | Difficulty | Starting tyre | Surface | AI order changes | AI stops by driver |
|---:|---|---|---|---:|---|
| 12 | Easy | Soft | Dry | 32 | 1, 0, 0, 1, 1 |
| 20 | Pro | Medium | Dry | 38 | 1, 1, 1, 1, 1 |
| 30 | Legend | Hard | Dry | 58 | 2, 1, 1, 2, 2 |
| 12 | Pro | Intermediate | Damp | 30 | 1, 0, 0, 1, 1 |
| 20 | Legend | Wet | Wet | 62 | 1, 1, 1, 1, 1 |

Order changes include pit cycles. All five races classified six cars, awarded championship points and recorded AI attacks in multiple parts of the circuit. The assisted player stop measured 10.85 seconds from entry to release, including 3.025 seconds of service sampled at 25 ms intervals. Other checks cover circuit closure, spacing, width, corner continuity, wall projection, compound changes, flag pace limits and return to Open World.

At an emulated 932 × 480 landscape viewport, Chrome exercised analogue throttle and steering, touch braking while accelerating, input release, and control bounds. The joystick was 130 pixels wide and the brake pedal 82 pixels. Physical-phone performance and human driving feel have not been measured. The embedded audio payload, LEGO face textures, pit-crew animation block and Open World route definitions were compared against the uploaded v54 and matched byte for byte.

Run the checks from the repository root. For the browser checks, set `CHROME_BIN` if Chrome is installed in a nonstandard location. Set `THREE_ROOT` to the unpacked Three.js 0.160.0 package to run with local engine assets.

```sh
BRICKWAY_HTML=./index.html node --test f1core.test.js
node competitive-regression.js
node competitive-regression.js --mobile
```
