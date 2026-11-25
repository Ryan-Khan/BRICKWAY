# BRICKWAY

A browser-based brick-built driving game with Open World pursuits and Grand Prix racing. The production game is served as static files. Use a WebGL-capable browser with hardware acceleration for normal play.

```sh
python3 -m http.server 4173
```
## Driving

| Control | Action |
|---|---|
| W / ↑, S / ↓ | Accelerate, brake or reverse |
| A / →, D / ← | Steer right and left, following the existing BRICKWAY mapping |
| Space | Drift in Open World or brake in Grand Prix |
| Shift | Boost in Open World or deploy ERS in Grand Prix |
| C or View | Cycle chase, hood, high chase and cockpit |
| P or Request Pit | Queue or cancel an assisted pit stop |
| Escape | Settings |
| R | Reset to the mode's starting location |

Landscape touch controls include steer, throttle, brake and a quick button for the cockpit. A standard gamepad uses left stick, right and left triggers, and the bottom face button for boost. The optional wheel preset expects steering on axis 0 with independent inverted throttle and brake on axes 1 and 2. Hardware with another mapping needs its driver or browser to expose those axes. Reduced camera motion is the default. Settings also include optional race traction assistance.

## Open World

Follow the east coast to **Skyspan Bridge** or **Dockside Crossing**. The harbor has an industrial port, hill roads, alternate routes and traffic on its outer loop. The bridge profiles drive the road mesh, vehicle elevation and rail boundaries. The road and hill use the same elevation function. The minimap outlines the new roads and marks active job destinations.

**Skyspan Courier** rewards fast deliveries. **Container Getaway** triggers a three-star pursuit and accepts either crossing before requiring the driver to lose the police. **Harbor Sprint** is a timed route through the port and back. A timer starts when you reach the first checkpoint. The garage saves owned and equipped cars, the stud balance and job best times together. Existing balances are imported the first time you play.

Ground police investigate last known positions, use the crossings to reach the other shore, and send some units ahead. Staying out of sight gives the escape meter time to fill. Open-sided covered garages can break helicopter sight. The City and Exit Car buttons and their keyboard shortcuts are removed in this build. Existing garage and job data are still stored.

## Grand Prix

Lewis Hamilton #44 has the strongest power and tyre preservation. Max Verstappen #1 has the highest dry cornering multiplier and commits early to overtakes. Charles Leclerc #16 holds the longest defensive line, Lando Norris #4 preserves tyres, and Fernando Alonso #14 is tuned to attack smaller openings. These are fictional game balance profiles inspired by driving styles. The higher Legend difficulty tightens AI braking margins.

Watch the ERS percentage before deploying boost. Brake to recover energy, and plan tyre changes around weather and wear. Select the next compound and request a stop before the entry boards. The game blends the driver onto the pit trajectory, limits lane speed, waits for the crew, then returns control after the merge. Track barriers are built from the same signed boundaries used to resolve vehicle contact. Cockpit mode carries through the stop.

After classification, **Watch Replay** plays the latest recorded segment, up to about 25 seconds. Pause or scrub to inspect the run, then return to the results. The existing qualifying ghost, penalties, and championship scoring remain available.

