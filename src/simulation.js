import * as Cesium from "cesium";

import { app } from "./app.js";
import { shipOptions, simulationOptions } from "./settings.js";
import { live, shipSpeed } from "./state.svelte.js";
import { windFileAt, lastWindFile } from "./wind/wind3D.js";

// index of the last route point at or before `distance` (m from departure), by binary search; 0 before the first point
function lastRoutePointAt(route, distance) {
  let low = 0;
  let high = route.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (route[mid][1] <= distance) low = mid;
    else high = mid - 1;
  }
  return low;
}

// Computes the voyage in fixed steps of simulated time and keeps every step in `track`.
// Playing appends steps, scrubbing back only looks them up, scrubbing forward computes the gap first.
// A sample holds the forces at its moment and the cumulative values from departure until then.
export class Simulation {
  constructor() {
    this.step = simulationOptions.stepSeconds;
    this.track = [];
    this.target = 0;
    this.running = false;
    // increases on reset, so a computation that is still running stops
    this.generation = 0;

    this.attachClock();
  }

  // called by ship.initialize() after a settings change (app.ship is not set yet on the first call)
  reset(ship) {
    this.generation++;
    this.running = false;
    this.track = [];
    this.target = 0;
    this.route = ship.route;
    this.shipSpeed = shipSpeed();
    this.startIso = Cesium.JulianDate.toIso8601(ship.start);
    this.duration = this.route[this.route.length - 1][1] / this.shipSpeed;
    this.sampleCount = Math.ceil(this.duration / this.step) + 1;

    live.startIso = this.startIso;
    live.duration = this.duration;
    live.elapsed = 0;
    live.sample = null;
    live.computedUntil = 0;
    live.buffering = false;
    live.loadErrorAt = null;
    live.playing = false;
    live.trackVersion++;

    this.ensure(simulationOptions.lookaheadSeconds);
  }

  sampleTime(index) {
    return Math.min(index * this.step, this.duration);
  }

  // position and heading at `seconds` after departure: the last route point passed, like the old per-tick update
  routeStateAt(seconds) {
    const route = this.route;
    const low = lastRoutePointAt(route, seconds * this.shipSpeed);
    return {
      longitude: route[low][0][0],
      latitude: route[low][0][1],
      // the last route point has no heading (0), so use the heading of the second to last one
      shipDirection: route[Math.min(low, route.length - 2)][2],
    };
  }

  isoAt(seconds) {
    return Cesium.JulianDate.toIso8601(Cesium.JulianDate.addSeconds(Cesium.JulianDate.fromIso8601(this.startIso), seconds, new Cesium.JulianDate()), 0);
  }

  computeSample(index, windData) {
    const { kite } = app;
    const time = this.sampleTime(index);
    const position = this.routeStateAt(time);
    const { u, v } = kite.getWindData(windData, position.longitude, position.latitude);
    const forces = kite.calculateForces(u, v, position.shipDirection, this.shipSpeed);

    const previous = this.track[index - 1];
    // the force of the previous step pulls until this step
    const fuelSavings = previous ? previous.fuelSavings + kite.fuelSaved(previous.kiteForce, this.shipSpeed, time - previous.time) : 0;

    const fuelConsumptionWithoutKite = kite.fuelConsumptionInKgPerSecond() * time;
    const fuelConsumptionWithKite = fuelConsumptionWithoutKite - fuelSavings;

    return {
      time,
      ...position,
      shipSpeed: this.shipSpeed,
      ...forces,
      fuelConsumptionWithoutKite,
      fuelConsumptionWithKite,
      fuelSavings,
      co2Savings: fuelSavings * shipOptions.co2PerFuel,
      overallKiteEfficiency: fuelConsumptionWithoutKite === 0 ? 0 : 100 - (fuelConsumptionWithKite / fuelConsumptionWithoutKite) * 100,
    };
  }

  // make sure the voyage is computed up to `seconds` after departure
  ensure(seconds) {
    // after a failed wind file, only play() or seek() try again
    if (live.loadErrorAt !== null) return;
    const index = Math.min(this.sampleCount - 1, Math.ceil(Math.min(seconds, this.duration) / this.step));
    this.target = Math.max(this.target, index);
    if (!this.running) {
      this.run();
    }
  }

  async run() {
    const generation = this.generation;
    this.running = true;
    let lastPublish = 0;

    while (this.track.length <= this.target) {
      const index = this.track.length;
      // wind data ends on 31 January: keep the last wind field for the rest of the voyage, like the globe does
      const file = windFileAt(this.isoAt(this.sampleTime(index))) ?? lastWindFile();

      let windData;
      try {
        windData = await app.wind3D.loadWindData(file);
      } catch (error) {
        console.error("Could not load wind file: " + file, error);
        if (generation === this.generation) {
          this.running = false;
          live.loadErrorAt = this.sampleTime(index);
          live.playing = false;
        }
        return;
      }
      if (generation !== this.generation) return;

      // all samples that use this wind file can be computed without waiting
      while (this.track.length <= this.target) {
        const next = this.track.length;
        if ((windFileAt(this.isoAt(this.sampleTime(next))) ?? lastWindFile()) !== file) break;
        this.track.push(this.computeSample(next, windData));
      }

      const now = performance.now();
      if (now - lastPublish > 100) {
        lastPublish = now;
        this.publishProgress();
      }
    }

    this.running = false;
    this.publishProgress();
  }

  publishProgress() {
    live.computedUntil = this.track.length ? this.track[this.track.length - 1].time : 0;
    live.trackVersion++;
  }

  // sample at any time: cumulative values interpolated, forces from the step before. null if not computed yet
  sampleAt(seconds) {
    const t = Math.max(0, Math.min(seconds, this.duration));
    const index = Math.min(Math.floor(t / this.step), this.sampleCount - 1);
    const before = this.track[index];
    if (!before) return null;
    if (index === this.sampleCount - 1 || before.time === t) return before;
    const after = this.track[index + 1];
    if (!after) return null;

    const f = (t - before.time) / (after.time - before.time);
    const mix = (key) => before[key] + (after[key] - before[key]) * f;
    const fuelConsumptionWithoutKite = mix("fuelConsumptionWithoutKite");
    const fuelConsumptionWithKite = mix("fuelConsumptionWithKite");
    return {
      ...before,
      time: t,
      fuelConsumptionWithoutKite,
      fuelConsumptionWithKite,
      fuelSavings: mix("fuelSavings"),
      co2Savings: mix("co2Savings"),
      overallKiteEfficiency: fuelConsumptionWithoutKite === 0 ? 0 : 100 - (fuelConsumptionWithKite / fuelConsumptionWithoutKite) * 100,
    };
  }

  attachClock() {
    const { wind3D } = app;
    const clock = wind3D.viewer.clock;

    clock.onTick.addEventListener(() => {
      if (!this.route) return;
      const elapsed = Cesium.JulianDate.secondsDifference(clock.currentTime, app.ship.start);
      live.elapsed = Math.max(0, Math.min(elapsed, this.duration));

      const sample = this.sampleAt(elapsed);

      // while buffering, live.sample keeps the last computed sample so the UI does not jump
      if (sample) {
        live.sample = sample;
        live.buffering = false;
        app.ship.updateKite(sample);
      } else {
        live.buffering = true;
        this.ensure(elapsed);
      }

      if (live.playing && elapsed >= this.duration) {
        live.playing = false;
      }
      clock.shouldAnimate = live.playing && !live.buffering;
      clock.multiplier = live.multiplier;

      if (live.playing) {
        this.ensure(elapsed + simulationOptions.lookaheadSeconds);
      }
    });
  }

  play() {
    live.loadErrorAt = null;
    if (live.elapsed >= this.duration) this.seek(0);
    live.playing = true;
  }

  pause() {
    live.playing = false;
  }

  seek(seconds) {
    const { wind3D, ship } = app;
    const t = Math.max(0, Math.min(seconds, this.duration));
    wind3D.viewer.clock.currentTime = Cesium.JulianDate.addSeconds(ship.start, t, new Cesium.JulianDate());
    live.loadErrorAt = null;
    this.ensure(t);
  }
}
