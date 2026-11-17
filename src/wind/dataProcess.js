import * as Cesium from "cesium";

export const DataProcess = (function () {
  const loadData = async function (filePath) {
    const data = {};

    const rawdata = await fetch(filePath).then((r) => r.json());

    function getMinMax(array) {
      let min = array[0],
        max = array[0];
      for (let i = 1; i < array.length; i++) {
        if (array[i] < min) min = array[i];
        if (array[i] > max) max = array[i];
      }
      return { min, max };
    }

    const steps = function (start, end, step) {
      const s = [];
      for (let i = start; i <= end; i += step) {
        s.push(i);
      }

      return s;
    };

    data.dimensions = {
      lon: 720,
      lat: 361,
      lev: 1,
    };

    data.lon = {
      array: new Float32Array(steps(0, 359.5, 0.5)),
      min: 0,
      max: 359.5,
    };

    data.lat = {
      array: new Float32Array(steps(-90, 90, 0.5)),
      min: -90,
      max: 90,
    };

    data.lev = {
      array: new Float32Array([0]),
      min: 0,
      max: 0,
    };

    // GFS rows run from north to south (90 to -90), lat.array runs from south to north: flip the rows.
    // surplus values at the end of the file are ignored.
    const flipRows = function (array) {
      const flipped = new Float32Array(720 * 361);
      for (let row = 0; row < 361; row++) {
        flipped.set(array.slice((360 - row) * 720, (361 - row) * 720), row * 720);
      }
      return flipped;
    };

    const u = flipRows(rawdata.u);
    const v = flipRows(rawdata.v);

    data.U = {
      array: u,
      ...getMinMax(u),
    };

    data.V = {
      array: v,
      ...getMinMax(v),
    };

    return data;
  };

  const randomizeParticles = function (data, maxParticles, viewerParameters) {
    const array = new Float32Array(4 * maxParticles);
    for (let i = 0; i < maxParticles; i++) {
      array[4 * i] = Cesium.Math.randomBetween(viewerParameters.lonRange.x, viewerParameters.lonRange.y);
      array[4 * i + 1] = Cesium.Math.randomBetween(viewerParameters.latRange.x, viewerParameters.latRange.y);
      array[4 * i + 2] = Cesium.Math.randomBetween(data.lev.min, data.lev.max);
      array[4 * i + 3] = 0.0;
    }
    return array;
  };

  return {
    loadData: loadData,
    randomizeParticles: randomizeParticles,
  };
})();
