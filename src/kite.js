import { fileOptions, kiteOptions, shipOptions, shipSpeeds } from "./settings.js";
import { settings, shipType } from "./state.svelte.js";

// wind relative to the moving ship (what the kite feels): direction it blows to (degrees) and speed (m/s)
export function apparentWind({ windSpeed, windDirection, shipSpeed, shipDirection }) {
  const rad = Math.PI / 180;
  const east = windSpeed * Math.sin(windDirection * rad) - shipSpeed * Math.sin(shipDirection * rad);
  const north = windSpeed * Math.cos(windDirection * rad) - shipSpeed * Math.cos(shipDirection * rad);
  return { direction: (Math.atan2(east, north) / rad + 360) % 360, speed: Math.hypot(east, north) };
}

export class Kite {
  constructor() {
    this.model3dUrl = fileOptions.kiteDirectory;

    this.cA = kiteOptions.cA;
    this.gZ = kiteOptions.gZ;

    this.gamma = (Math.atan(1 / this.gZ) * 180) / Math.PI;

    this.windowAngleLoop = ((90 - this.gamma) / 10) * kiteOptions.windWindowPositionLoop;
    this.windowAngleSinus = ((90 - this.gamma) / 10) * kiteOptions.windWindowPositionSinus;

    this.heightAngleLoop = kiteOptions.kiteHeightAngleLoop;
    this.heightAngleSinus = kiteOptions.kiteHeightAngleSinus;

    this.fuelEnergyDensity = shipOptions.fuelEnergyDensity;
    this.motorEfficiency = shipOptions.motorEfficiency;
  }

  // fuel consumption of the selected ship type and speed without kite
  fuelConsumptionInKgPerSecond() {
    return (shipType().fuelConsumption[shipSpeeds.indexOf(settings.speedKnots)] / 86400) * 1000;
  }

  // wind at the nearest grid point; the grid is regular, so the index is computed directly
  getWindData(windData, lon, lat) {
    const lonStep = (windData.lon.max - windData.lon.min) / (windData.dimensions.lon - 1);
    const latStep = (windData.lat.max - windData.lat.min) / (windData.dimensions.lat - 1);

    // % wraps 359.9° to the first column (0°), the grid point nearest to it
    const lonCoordinateIndex = Math.round(((((lon % 360) + 360) % 360) - windData.lon.min) / lonStep) % windData.dimensions.lon;
    const latCoordinateIndex = Math.round((lat - windData.lat.min) / latStep);

    const windIndex = lonCoordinateIndex + windData.dimensions.lon * latCoordinateIndex;

    return { u: windData.U.array[windIndex], v: windData.V.array[windIndex] };
  }

  // forces at one moment; u, v = wind at the ship (m/s), shipDirection in degrees, shipSpeed in m/s
  calculateForces(u, v, shipDirection, shipSpeed) {
    const kiteSize = settings.kiteSize;

    const windSpeed = Math.sqrt(u ** 2 + v ** 2);

    // direction the wind is blowing to (0 = north, 90 = east), same convention as shipDirection
    const windDirection = ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360;

    let differenceDirection = Math.abs(windDirection - shipDirection);

    if (differenceDirection > 180) {
      differenceDirection = 360 - differenceDirection;
    }

    // the ship always moves (at least 18 kn), so shipSpeed is never 0 here
    const shipWindSpeed = (windSpeed ** 2 + shipSpeed ** 2 - 2 * windSpeed * shipSpeed * Math.cos((differenceDirection / 180) * Math.PI)) ** 0.5;
    let shipWindDirection;

    if (shipWindSpeed !== 0) {
      // clamp to [-1, 1], otherwise rounding errors make acos() return NaN
      const cosShipWindDirection = (shipWindSpeed ** 2 + shipSpeed ** 2 - windSpeed ** 2) / (2 * shipWindSpeed * shipSpeed);
      shipWindDirection = (Math.acos(Math.min(1, Math.max(-1, cosShipWindDirection))) * 180) / Math.PI;
    } else {
      shipWindDirection = 0;
    }

    let active, flymode, kiteForce;

    if (shipWindDirection > kiteOptions.figureEightMinAngle && shipWindSpeed !== 0) {
      active = true;
      flymode = "figure-eight";

      const flowVelocity = (shipWindSpeed * Math.sin(((90 - this.windowAngleLoop) * Math.PI) / 180)) / Math.sin((this.gamma * Math.PI) / 180);

      const allKiteForce = (kiteOptions.airDensity / 2) * flowVelocity ** 2 * kiteSize * this.cA;

      kiteForce = allKiteForce * Math.cos(((180 - shipWindDirection) / 180) * Math.PI) * Math.cos((this.heightAngleLoop / 180) * Math.PI);
    } else if (shipWindDirection + this.windowAngleSinus > 90 && shipWindSpeed !== 0) {
      active = true;
      flymode = "sine wave";

      const flowVelocity = (shipWindSpeed * Math.sin(((90 - this.windowAngleSinus) * Math.PI) / 180)) / Math.sin((this.gamma * Math.PI) / 180);

      const allKiteForce = (kiteOptions.airDensity / 2) * flowVelocity ** 2 * kiteSize * this.cA;

      kiteForce =
        allKiteForce * Math.cos(((180 - (shipWindDirection + this.windowAngleSinus)) / 180) * Math.PI) * Math.cos((this.heightAngleSinus / 180) * Math.PI);
    } else {
      active = false;
      flymode = "not flying";
      kiteForce = 0;
    }

    const motorForceWithoutKite = (this.fuelConsumptionInKgPerSecond() * this.fuelEnergyDensity * this.motorEfficiency) / shipSpeed;

    let motorForceWithKite;

    if (motorForceWithoutKite - kiteForce > 0) {
      motorForceWithKite = motorForceWithoutKite - kiteForce;
    } else {
      motorForceWithKite = 0;
      kiteForce = motorForceWithoutKite;
    }

    const currentKiteEfficiency = kiteForce === 0 ? 0 : 100 - (motorForceWithKite / motorForceWithoutKite) * 100;

    return {
      windSpeed,
      windDirection,
      shipWindSpeed,
      shipWindDirection,
      active,
      flymode,
      kiteForce,
      motorForceWithoutKite,
      motorForceWithKite,
      currentKiteEfficiency,
    };
  }

  // fuel in kg that the kite saves while pulling with kiteForce for seconds
  fuelSaved(kiteForce, shipSpeed, seconds) {
    return ((kiteForce * shipSpeed) / (this.fuelEnergyDensity * this.motorEfficiency)) * seconds;
  }
}
