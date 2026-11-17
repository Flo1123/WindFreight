import {
  ports,
  defaultRouteOptions,
  shipOptions,
  shipTypes,
  shipSpeeds,
  routes,
  globeLayers,
  defaultLayerOptions,
  defaultParticleSystemOptions,
  kiteOptions,
  windFileDates,
  startHours,
} from "./settings.js";

// everything the user can set; the simulation reads from here
export const settings = $state({
  start: ports[defaultRouteOptions.startingPointIndex],
  destination: ports[defaultRouteOptions.destinationIndex],
  shipTypeIndex: shipOptions.defaultTypeIndex,
  speedKnots: shipSpeeds[shipOptions.defaultSpeedIndex],
  kiteSize: kiteOptions.defaultKiteSize,
  startDate: shipOptions.startTime.slice(0, 10), // YYYY-MM-DD
  startHour: parseInt(shipOptions.startTime.slice(11, 13), 10),
  layer: globeLayers[defaultLayerOptions.globeLayer].name,
  showParticles: true,
  maxParticles: defaultParticleSystemOptions.maxParticles,
  speedFactor: defaultParticleSystemOptions.speedFactor,
  lineWidth: defaultParticleSystemOptions.lineWidth,
  opacity: defaultParticleSystemOptions.opacity,
  follow: false, // camera follows the ship
});

// voyage settings from the address bar, written by App.svelte, e.g. ?from=rotterdam&to=shanghai&ship=5000-6000&speed=20&kite=1500&date=2024-01-05&time=06
// invalid or missing values keep their defaults
{
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") + params.get("to") in routes) {
    settings.start = params.get("from");
    settings.destination = params.get("to");
  }
  const typeIndex = shipTypes.findIndex((type) => type.name === params.get("ship"));
  if (typeIndex >= 0) settings.shipTypeIndex = typeIndex;
  const speed = Number(params.get("speed"));
  if (speedsFor(settings.shipTypeIndex).includes(speed)) settings.speedKnots = speed;
  const kite = Number(params.get("kite"));
  if (params.has("kite") && kite >= kiteOptions.minKiteSize && kite <= kiteOptions.maxKiteSize) {
    settings.kiteSize = Math.round(kite / kiteOptions.kiteSizeStep) * kiteOptions.kiteSizeStep;
  }
  const date = params.get("date") ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && windFileDates.includes(date.replaceAll("-", ""))) settings.startDate = date;
  const hour = parseInt(params.get("time"), 10);
  if (startHours.includes(hour)) settings.startHour = hour;
}

// values the simulation writes for the UI
export const live = $state({
  ready: false,
  playing: false,
  multiplier: shipOptions.clockMultiplier,
  // departure as ISO string, seconds since departure and voyage length in seconds
  startIso: "",
  elapsed: 0,
  duration: 1,
  // current simulation sample (see simulation.js); while buffering the last computed one, null right after a reset
  sample: null,
  // seconds of the voyage that are already computed
  computedUntil: 0,
  // true while playback waits for the simulation
  buffering: false,
  // seconds after departure where a wind file could not be loaded, null if there was no error
  loadErrorAt: null,
  // increases whenever new samples are added, so charts can redraw
  trackVersion: 0,
  windFile: "",
});

// derived helpers, plain functions so they work in .svelte and .js files

export function routeKey() {
  return settings.start + settings.destination;
}

export function destinationsFor(start) {
  return ports.filter((port) => start + port in routes);
}

export function shipType() {
  return shipTypes[settings.shipTypeIndex];
}

export function speedsFor(typeIndex) {
  return shipSpeeds.slice(0, shipTypes[typeIndex].fuelConsumption.length);
}

// speed in m/s
export function shipSpeed() {
  return settings.speedKnots * 0.5144;
}

export function startDateIso() {
  return settings.startDate + "T" + String(settings.startHour).padStart(2, "0") + ":00:00Z";
}

export function globeLayer() {
  return globeLayers.find((layer) => layer.name === settings.layer);
}
