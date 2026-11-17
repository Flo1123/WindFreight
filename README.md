# WindFreight

A 3D browser simulation of how much fuel and CO₂ a container ship can save with a towing kite.

A ship sails a real sea route on a CesiumJS globe. Real GFS wind data from January 2024 (NOAA) decides at every step whether the kite can fly, and in which pattern (figure-eight or sine wave). From that the simulation computes the kite force, the remaining engine force and the cumulative fuel and CO₂ savings. The wind field is also shown as animated particles on the globe.

## Getting started

Requires Node.js 20 or newer.

```sh
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the production build
```

The globe needs a [Cesium ion](https://ion.cesium.com) access token (scope `assets:read`, assets 1 and 3954). Put it in `.env.local` in the project root:

```
VITE_CESIUM_TOKEN=eyJ...
```

For the production build, put the production token (restricted to your domain) in `.env.production.local` instead, or set `VITE_CESIUM_TOKEN` as an environment variable on the build server. Both files are ignored by git.

Keyboard shortcuts: `r` reloads the page, `v` toggles fullscreen.

## Using the simulation

- **Left panel (inputs):** map layer, start date, start and destination port, ship type, speed and kite size. Every change restarts the voyage.
- **Right panel (outputs):** wind and ship direction and speed, engine force with and without the kite, kite force, flight mode, fuel consumption, fuel and CO₂ savings, kite efficiency.
- Start, pause and speed up the voyage with the clock widget at the bottom left.

Available routes: Rotterdam ↔ Shanghai, Mumbai, New York, Santos, and Shanghai ↔ Los Angeles.

## Project structure

```
index.html           entry page
src/
  main.js            creates all parts of the app
  settings.js        all constants: kite, ship types, fuel data, routes, layers
  gui.js             input and output panels, wind file switching
  ship.js            ship movement along the route
  kite.js            kite physics and savings calculation
  routes.js          route data (generated, see tools/route-converter)
  wind/              Cesium viewer and GPU wind particles
public/
  dataSets/          wind data as JSON (one file per 6 hours)
  models/            3D models of ship and kite
tools/
  grib-converter/    downloads GFS GRIB2 files and converts them to JSON
  route-converter/   converts GeoJSON routes to the format in routes.js
```

## Data

- **Wind:** NOAA GFS analysis, 0.5° grid, 10 m wind (U/V), 1–31 January 2024 at 00, 06, 12 and 18 UTC. Generated with `tools/grib-converter` (`cd tools/grib-converter && npm install && node grib.js`).
- **Routes:** GeoJSON sea routes in `tools/route-converter/routes/`, converted with `tools/route-converter/converter.html` and pasted into `src/routes.js`.
- **Ship models:** compressed with Draco (`npm run compress-model -- input.glb output.glb`).

## Credits

The wind particle rendering is based on [3D-Wind-Field](https://github.com/RaymanNg/3D-Wind-Field) by RaymanNg (MIT license, see `license.txt`).
