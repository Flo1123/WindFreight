import {
  rotterdamshanghai,
  shanghairotterdam,
  rotterdammumbai,
  mumbairotterdam,
  rotterdamnewyork,
  newyorkrotterdam,
  rotterdamsantos,
  santosrotterdam,
  shanghailosangeles,
  losangelesshanghai,
} from "./routes.js";

export const kiteOptions = {
  defaultKiteSize: 1000, //in m^2
  // range of the kite area slider (and of ?kite= in the URL), in m^2
  minKiteSize: 100,
  maxKiteSize: 5000,
  kiteSizeStep: 50,
  cA: 1.2,
  gZ: 6,

  // air at sea level, International Standard Atmosphere: https://en.wikipedia.org/wiki/International_Standard_Atmosphere
  airDensity: 1.225, // kg/m^3

  // the kite flies figure eights when the apparent wind angle is larger than this, otherwise a sine wave
  // source: own measurement (90° + 53°)
  figureEightMinAngle: 143, // degrees

  kiteHeightAngleLoop: 34, //degrees
  kiteHeightAngleSinus: 30, //degrees

  windWindowPositionLoop: 4,
  windWindowPositionSinus: 5,

  // display only, not used in the physics: tow line length and kite model width per m² of kite area
  lineLength: 300, // m
  modelWidth: 4.77, // width of public/models/kite.glb in model units
  wingspanPerSqrtArea: 1.25, // a 1000 m² kite is about 40 m wide
};

export const shipOptions = {
  defaultTypeIndex: 0,
  defaultSpeedIndex: 0,

  realScale: 3, // public/models/ship.glb is 110 units long -> 330 m

  //most commonly used fuel: https://www.umweltbundesamt.de/service/uba-fragen/welchem-kraftstoff-fahren-seeschiffe
  //https://de.statista.com/statistik/daten/studie/1461265/umfrage/energiedichte-verschiedener-schiffskraftstoffe/

  //https://www.bundestag.de/resource/blob/876928/1c1929bbc1eaa0d85553ff4ed7e4f6eb/WD-8-093-21-pdf.pdf
  // energy density = 40'200 kJ/kg = 40'200'000 J/kg
  //density of heavy fuel oil (mean): 965 kg/m^3
  fuelEnergyDensity: 40200000, //in J/kg

  //carbon content of heavy fuel oil = 0.8493
  //Co2 / Fuel = 3,114
  co2PerFuel: 3.114, // coefficient

  //https://www.wartsila.com/sustainability/climate-and-environment/innovating-for-sustainability/improving-efficiency
  motorEfficiency: 0.5,

  startTime: "2024-01-01T00:00:00Z",

  clockMultiplier: 10000,
};

//https://www.researchgate.net/publication/229050596_Fuel_surcharge_practices_of_container_shipping_lines_Is_it_about_cost_recovery_or_revenue-making

// in knots, one per column of fuelConsumption below
export const shipSpeeds = [18, 19, 20, 21, 22, 23, 24, 25];

export const shipTypes = [
  //in tonnes/day
  {
    name: "2000-3000",
    fuelConsumption: [47.0, 56.1, 66.5, 78.1],
  },
  {
    name: "3000-4000",
    fuelConsumption: [54.9, 65.6, 77.7, 91.3, 106.4],
  },
  {
    name: "4000-5000",
    fuelConsumption: [52.8, 63.1, 74.7, 87.8, 102.4, 118.5, 136.4],
  },
  {
    name: "5000-6000",
    fuelConsumption: [57.9, 69.3, 82.0, 96.4, 112.3, 130.1, 149.7, 171.3],
  },
  {
    name: "6000-7000",
    fuelConsumption: [68.8, 82.2, 97.4, 114.4, 133.4, 154.5, 177.8, 203.4],
  },
  {
    name: "7000-8000",
    fuelConsumption: [77.8, 93.0, 110.1, 129.4, 150.8, 174.7, 201.0, 230.0],
  },
  {
    name: "8000-9000",
    fuelConsumption: [87.9, 105.1, 124.5, 146.2, 170.5, 197.5, 227.2, 260.0],
  },
  {
    name: "9000-10000",
    fuelConsumption: [98.8, 118.1, 139.8, 164.2, 191.5, 211.8, 255.2, 292.0],
  },
  {
    name: "10000+",
    fuelConsumption: [124.1, 148.4, 175.7, 206.4, 240.7, 278.7, 320.7, 367.0],
  },
];

export const shipTypeNames = shipTypes.map((shiptype) => shiptype.name);

// the simulation computes fuel and CO2 in fixed steps of simulated time, independent of the frame rate
export const simulationOptions = {
  stepSeconds: 600,
  // computed ahead of the current time while playing, so playback does not stall
  lookaheadSeconds: 12 * 3600,
};

// playback speeds (simulated seconds per real second)
export const speedMultipliers = [1000, 2500, 5000, 10000, 25000, 50000, 100000];

export const displayOptions = {
  // camera distance (m) below which the 3D models replace the ship marker
  modelDistance: 150000,
  // follow camera: initial distance (m) and pitch (degrees) above the ship
  followRange: 1200000,
  followPitch: -65,
  // how often the travelled part of the route is redrawn (ms)
  routeRedrawInterval: 250,
  // wind particles fade out between these camera heights (m): the wind data has a 0.5° grid (~55 km),
  // closer up all particles would crowd into a tiny area with the same wind
  particleFadeStart: 1500000,
  particleFadeEnd: 400000,
};

export const particleCounts = [64 * 64, 128 * 128, 192 * 192, 256 * 256];

export const defaultTimeOptions = {
  windUpdateStep: 6, //in hours, min: 6, max:24
};

export const ports = ["rotterdam", "shanghai", "newyork", "santos", "mumbai", "losangeles"];

export const portNames = {
  rotterdam: "Rotterdam",
  shanghai: "Shanghai",
  newyork: "New York",
  santos: "Santos",
  mumbai: "Mumbai",
  losangeles: "Los Angeles",
};

export const defaultRouteOptions = {
  startingPointIndex: 0,
  destinationIndex: 1,
};

export const routes = {
  rotterdamshanghai,
  shanghairotterdam,
  rotterdammumbai,
  mumbairotterdam,
  rotterdamnewyork,
  newyorkrotterdam,
  rotterdamsantos,
  santosrotterdam,
  shanghailosangeles,
  losangelesshanghai,
};

export const fileOptions = {
  dataDirectory: "dataSets/",
  shipDirectory: "models/ship.glb",
  kiteDirectory: "models/kite.glb",
};

export const defaultParticleSystemOptions = {
  maxParticles: 128 * 128,
  particleHeight: 100.0,
  fadeOpacity: 0.985,
  dropRate: 0.003,
  dropRateBump: 0.01,
  speedFactor: 3.0,
  lineWidth: 1.5,
  opacity: 0.8,
  maxColorWindSpeed: 20.0, // m/s, wind speed that gets the strongest color (red)
};

export const globeLayers = [
  {
    name: "Dark",
    label: "Dark map",
    type: "Carto",
    // free CARTO Basemaps key in VITE_CARTO_KEY (https://carto.com/basemaps/apikey); without it the globe stays empty
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}@2x.png",
    // must stay visible (https://carto.com/attribution)
    attribution: [
      { text: "© OpenStreetMap", href: "https://www.openstreetmap.org/copyright" },
      { text: "© CARTO", href: "https://carto.com/attribution" },
    ],
  },
  { name: "WorldTerrain", label: "Satellite + terrain", type: "WorldTerrain" },
  {
    name: "WMS:Air Pressure",
    label: "Air pressure (WMS)",
    // NOAA's THREDDS server returns HTTP 500 for January 2024
    offline: true,
    type: "WMS",
    layer: "Pressure_surface",
    ColorScaleRange: "51640,103500",
  },
  {
    name: "WMS:Wind Speed",
    label: "Wind gusts (WMS)",
    offline: true,
    type: "WMS",
    layer: "Wind_speed_gust_surface",
    ColorScaleRange: "0.1095,35.31",
  },
];

export const defaultLayerOptions = {
  globeLayer: 0,
};

// available wind files in public/dataSets/ (January 2024)
export const windFileDates = Array.from({ length: 31 }, (_, i) => "202401" + String(i + 1).padStart(2, "0"));

export const windFileTimes = ["0000", "0600", "1200", "1800"];

// possible departure hours (UTC): the times of the wind files
export const startHours = windFileTimes.map((time) => parseInt(time.slice(0, 2), 10));

export const forecastHours = "006";

/*
        Asia-Europe route:
        Shanghai, China (122.056762, 30.616986)
        Rotterdam, Netherlands (4.080639, 51.982069)

        Transpacific route:
        Shanghai, China (122.056762, 30.616986)
        Los Angeles, USA (-118.248328, 33.709820)

        Transatlantic route:
        Rotterdam, Netherlands (4.080639, 51.982069)
        New York, USA (-74.042676, 40.602249)

        India-Europe route:
        Mumbai, India (72.926917, 18.941615)
        Rotterdam, Netherlands (4.080639, 51.982069)

        South America route:
        Santos, Brazil (-46.306774, -23.992960)
        Rotterdam, Netherlands (4.080639, 51.982069)

        https://worldoceanreview.com/de/wor-1/transport/der-weltseeverkehr/
        https://geohilfe.de/welthandel-seeweg-visualisiert/
*/
