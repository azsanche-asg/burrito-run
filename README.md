# Burrito Run

A lightweight infinite runner about a brave little cargo-carrying donkey. It uses
only HTML, CSS, JavaScript, Canvas, and local image assets, so there are no packages
to install and no build step.

## Run the game

Serve the folder locally for the full sprite-rendering path:

```sh
python3 -m http.server 4173
```

Then visit <http://localhost:4173>.

Opening `index.html` directly still works, but some browsers restrict local image
pixel access and may show the simpler Canvas fallback art instead. Offline caching
also requires the game to be served over HTTP or HTTPS.

## Controls

- Jump: `Space`, `Arrow Up`, `W`, click, or tap
- Restart after a collision: `Space`, click, or tap
- Pause or resume: `P`, `Escape`, or the Pause button
- Toggle sound: `M` or the Sound button
- Toggle calm-motion mode: `C` or the Calm button
- Record a run: the `Record 1 min` button; press it again to stop early

## Journey systems

- Burrito begins with three cargo crates. A collision loses one crate and grants a
  short recovery window; another collision with no cargo remaining ends the run.
- Cargo pickups restore one crate. Provisions award bonus points when cargo is full.
- Running close to a sleeping paisano brings him aboard and awards a score bonus.
  His trail sprite disappears while his sombrero appears on Burrito's saddle until
  they reach the next destination.
- Reaching an oasis, apple grove, or carrot farm restores cargo, awards a milestone
  bonus, and transitions the trail between desert, canyon, and farmland.
- New desert creatures and faster-moving hazards enter the procedural pool as the
  journey gets longer.
- Best score, completed runs, rescues, and destinations are saved in browser
  storage under `burrito-run:career:v1` and restored on the next visit.

## Presentation and accessibility

- Lightweight jump, landing, collection, rescue, damage, destination, and game-over
  sounds are synthesized with the Web Audio API; there are no audio downloads.
- Pause activates automatically if the browser tab is hidden during a run.
- Calm mode keeps the essential ground motion while freezing distant parallax,
  removing screen shake, flashes, dust, and celebration particles.
- Biome colors blend into one another rather than changing in a single frame.
- Generated atlases are prepared one at a time and downscaled after their
  background matte is removed, reducing peak and steady-state memory use.

## Recording a run

`Record 1 min` starts recording the game canvas at 30 frames per second and starts
a run when the title screen is open. The recording stops automatically after one
minute, or the same button can stop it early. A local preview and download link then
appear below the game. Synthesized game audio is included when sound is enabled.

Recordings are created entirely in the browser and are never uploaded. Download a
clip before reloading or closing the page if you want to keep it. Browsers without
Canvas capture or MediaRecorder support show the recording control as unavailable.

## Offline play and installation

On the first online visit, `service-worker.js` caches the game shell and all sprite
atlases. After that installation completes, later visits can load without a network
connection in browsers that support service workers. `manifest.webmanifest` and the
app icon also let compatible browsers install Burrito Run as a standalone game.

When changing a cached release, update `CACHE_NAME` in `service-worker.js` so existing
players receive a fresh cache.

## Static hosting

The entire folder can be uploaded to any static web host. Keep the file structure
intact and serve `index.html` from the project root; there is no build command or
server-side runtime.

## Project structure

- `index.html` — accessible game shell and HUD
- `styles.css` — responsive page, overlay, and interface styles
- `game.js` — game loop, physics, collisions, procedural obstacles, and rendering
- `manifest.webmanifest` — installable app metadata
- `service-worker.js` — offline asset cache and navigation fallback
- `assets/burrito-run-icon.svg` — standalone app icon
- `assets/sprites/` — character, hazard, paisano, destination, and reward artwork

The fixed 960×540 game world is scaled responsively by CSS. Rendering accounts for
high-density screens, while gameplay calculations stay in a simple fixed coordinate
system.

Generated character and cactus art is used during play. If an atlas cannot load,
simple Canvas drawings remain available as a graceful fallback.
