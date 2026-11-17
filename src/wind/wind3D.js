import * as Cesium from "cesium";

import { fileOptions, defaultTimeOptions, windFileDates, windFileTimes, forecastHours, defaultParticleSystemOptions, displayOptions } from "../settings.js";
import { settings, live, startDateIso, globeLayer } from "../state.svelte.js";
import { Util } from "./util.js";
import { DataProcess } from "./dataProcess.js";
import { ParticleSystem } from "./particleSystem.js";

// wind files kept in memory (about 2 MB each): the shown one, the next one and the simulation's 12 h lookahead
const maxCachedWindFiles = 4;

// file name of the wind file that applies to an ISO time, or null if there is none
export function windFileAt(iso) {
  const date = iso.slice(0, 4) + iso.slice(5, 7) + iso.slice(8, 10);
  const roundedHours = Math.floor(parseInt(iso.slice(11, 13), 10) / defaultTimeOptions.windUpdateStep) * defaultTimeOptions.windUpdateStep;
  const time = String(roundedHours).padStart(2, "0") + "00";

  if (!windFileDates.includes(date) || !windFileTimes.includes(time)) {
    return null;
  }
  return date + "_" + time + "_" + forecastHours + ".json";
}

// time of a wind file as ISO string: "20240105_0600_006.json" -> "2024-01-05T06:00:00Z" (the forecast hour is not added)
export function windFileIso(file) {
  return file.slice(0, 4) + "-" + file.slice(4, 6) + "-" + file.slice(6, 8) + "T" + file.slice(9, 11) + ":" + file.slice(11, 13) + ":00Z";
}

// ISO time `hours` after an ISO time
function addHours(iso, hours) {
  return new Date(Date.parse(iso) + hours * 3600000).toISOString().slice(0, 19) + "Z";
}

// end of the wind data as ISO string: the last file covers windUpdateStep hours
export function windDataEndIso() {
  return addHours(windFileIso(lastWindFile()), defaultTimeOptions.windUpdateStep);
}

export function lastWindFile() {
  return windFileDates[windFileDates.length - 1] + "_" + windFileTimes[windFileTimes.length - 1] + "_" + forecastHours + ".json";
}

export class Wind3D {
  constructor(container) {
    const options = {
      // the imagery layer is set in setGlobeLayer()
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      infoBox: false,
      selectionIndicator: false,
      fullscreenElement: container,
      // useBrowserRecommendedResolution can be set to false to improve the render quality
      useBrowserRecommendedResolution: false,

      scene3DOnly: true,

      homeButton: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      fullscreenButton: false,
      // replaced by the Svelte playback bar
      animation: false,
      timeline: false,
    };

    this.viewer = new Cesium.Viewer(container, options);
    this.scene = this.viewer.scene;
    this.camera = this.viewer.camera;

    // sharper globe: finer imagery tiles, no haze over the surface
    this.scene.globe.maximumScreenSpaceError = 1.5;
    this.scene.globe.showGroundAtmosphere = false;
    this.scene.fog.enabled = false;
    this.scene.globe.baseColor = Cesium.Color.fromCssColorString("#0a1f3a");

    // at most 2 device pixels per CSS pixel: on 3× phone screens full resolution would mean 2.25 times the pixels of 2×, for little visible gain
    this.viewer.resolutionScale = Math.min(1, 2 / window.devicePixelRatio);

    // particle options; the shaders read lineWidth, opacity and speedFactor from this object every frame
    this.particleInput = this.createParticleInput();

    // loaded or loading wind files (file name -> promise), oldest first, see loadWindData()
    this.windDataCache = new Map();

    this.viewerParameters = {
      lonRange: new Cesium.Cartesian2(),
      latRange: new Cesium.Cartesian2(),
      pixelSize: 0.0,
    };
    // use a smaller earth radius to make sure distance to camera > 0
    this.globeBoundingSphere = new Cesium.BoundingSphere(Cesium.Cartesian3.ZERO, 0.99 * 6378137.0);
    this.updateViewerParameters();

    this.showWindData(windFileAt(startDateIso()));

    this.setGlobeLayer();

    this.setupEventListeners();
  }

  // shared by the globe and the simulation, so every file is downloaded only once
  loadWindData(file) {
    if (!this.windDataCache.has(file)) {
      const promise = DataProcess.loadData(fileOptions.dataDirectory + file);
      // a failed file is removed, so the next request loads it again
      promise.catch(() => {
        if (this.windDataCache.get(file) === promise) this.windDataCache.delete(file);
      });
      this.windDataCache.set(file, promise);
      // drop the oldest files, but never the one shown on the globe
      for (const key of this.windDataCache.keys()) {
        if (this.windDataCache.size <= maxCachedWindFiles) break;
        if (key !== file && key !== this.dataFile) this.windDataCache.delete(key);
      }
    }
    return this.windDataCache.get(file);
  }

  // file name of the wind file windUpdateStep hours after file, or null if there is none
  nextWindFile(file) {
    return windFileAt(addHours(windFileIso(file), defaultTimeOptions.windUpdateStep));
  }

  async showWindData(file) {
    this.dataFile = file;

    let data;
    try {
      data = await this.loadWindData(file);
    } catch (error) {
      console.error("Could not load wind file: " + file, error);
      return;
    }

    // a newer file was requested in the meantime
    if (file !== this.dataFile) {
      return;
    }

    this.clearParticleSystem();
    this.updateViewerParameters();
    this.particleSystem = new ParticleSystem(this.scene.context, data, this.particleInput, this.viewerParameters);
    this.addPrimitives();
    this.particlesVisible = undefined;
    this.windData = data;
    live.windFile = file;

    // preload the next file so the switch does not stall
    const next = this.nextWindFile(file);
    if (next) {
      this.loadWindData(next);
    }
  }

  createParticleInput() {
    // make sure maxParticles is exactly the square of particlesTextureSize
    const particlesTextureSize = Math.ceil(Math.sqrt(settings.maxParticles));
    return {
      ...defaultParticleSystemOptions,
      particlesTextureSize: particlesTextureSize,
      maxParticles: particlesTextureSize * particlesTextureSize,
      speedFactor: settings.speedFactor,
      lineWidth: settings.lineWidth,
      opacity: settings.opacity,
    };
  }

  // apply the particle settings; only a different particle count needs a new particle system
  applyParticleSettings() {
    const input = this.createParticleInput();
    const rebuild = input.maxParticles !== this.particleInput.maxParticles;
    Object.assign(this.particleInput, input);

    if (rebuild && this.windData) {
      this.clearParticleSystem();
      this.particleSystem = new ParticleSystem(this.scene.context, this.windData, this.particleInput, this.viewerParameters);
      this.addPrimitives();
    }
    this.particlesVisible = undefined;
  }

  // close to the surface the particles fade out (see displayOptions.particleFadeStart)
  fadeParticlesByHeight() {
    const height = this.camera.positionCartographic.height;
    const fade = Cesium.Math.clamp((height - displayOptions.particleFadeEnd) / (displayOptions.particleFadeStart - displayOptions.particleFadeEnd), 0, 1);
    this.particleInput.opacity = settings.opacity * fade;
    const visible = settings.showParticles && fade > 0;
    if (visible !== this.particlesVisible) {
      this.particlesVisible = visible;
      this.showParticles(visible);
    }
  }

  particlePrimitives() {
    if (!this.particleSystem) {
      return [];
    }
    const computing = this.particleSystem.particlesComputing.primitives;
    const rendering = this.particleSystem.particlesRendering.primitives;
    // the order should respect the dependency of primitives
    return [computing.calculateSpeed, computing.updatePosition, computing.postProcessingPosition, rendering.segments, rendering.trails, rendering.screen];
  }

  clearParticleSystem() {
    if (!this.particleSystem) {
      return;
    }

    this.particleSystem.destroyTextures();
    this.removePrimitives();

    this.particleSystem = null;
  }

  addPrimitives() {
    this.particlePrimitives().forEach((primitive) => this.scene.primitives.add(primitive));
  }

  removePrimitives() {
    this.particlePrimitives().forEach((primitive) => this.scene.primitives.remove(primitive));
  }

  // show/hide only the particles, not the ship and route
  showParticles(show) {
    this.particlePrimitives().forEach((primitive) => {
      primitive.show = show;
    });
  }

  updateViewerParameters() {
    const viewRectangle = this.camera.computeViewRectangle(this.scene.globe.ellipsoid);
    const lonLatRange = Util.viewRectangleToLonLatRange(viewRectangle);
    this.viewerParameters.lonRange.x = lonLatRange.lon.min;
    this.viewerParameters.lonRange.y = lonLatRange.lon.max;
    this.viewerParameters.latRange.x = lonLatRange.lat.min;
    this.viewerParameters.latRange.y = lonLatRange.lat.max;

    const pixelSize = this.camera.getPixelSize(this.globeBoundingSphere, this.scene.drawingBufferWidth, this.scene.drawingBufferHeight);

    if (pixelSize > 0) {
      this.viewerParameters.pixelSize = pixelSize;
    }
  }

  // WMS URL for the wind file currently shown
  wmsUrl() {
    const date = this.dataFile.slice(0, 8);
    return "https://www.ncei.noaa.gov/thredds/wms/model-gfs-g4-anl-files/" + date.slice(0, 6) + "/" + date + "/gfs_4_" + this.dataFile.slice(0, -5) + ".grb2";
  }

  setGlobeLayer() {
    const layer = globeLayer();

    this.viewer.imageryLayers.removeAll();
    this.viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();

    // Cesium ion's logo and data credits must be visible while its content is shown (https://cesium.com/legal/terms-of-service/, 2.2.3);
    // only the satellite layer uses ion, the other layers credit their sources in App.svelte
    this.viewer.cesiumWidget.creditContainer.style.display = layer.type === "WorldTerrain" ? "" : "none";

    switch (layer.type) {
      case "Carto": {
        const key = import.meta.env.VITE_CARTO_KEY;
        if (key) {
          this.viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: layer.url + "?key=" + key,
              subdomains: ["a", "b", "c", "d"],
              maximumLevel: 18,
            }),
          );
        } else {
          console.warn("Dark map needs VITE_CARTO_KEY (see CLAUDE.md)");
        }
        break;
      }
      case "WMS": {
        this.viewer.imageryLayers.addImageryProvider(
          new Cesium.WebMapServiceImageryProvider({
            url: this.wmsUrl(),
            layers: layer.layer,
            parameters: {
              ColorScaleRange: layer.ColorScaleRange,
            },
          }),
        );
        break;
      }
      case "WorldTerrain": {
        this.viewer.imageryLayers.add(Cesium.ImageryLayer.fromProviderAsync(Cesium.IonImageryProvider.fromAssetId(3954)));
        Cesium.createWorldTerrainAsync().then((terrainProvider) => {
          // only apply if the layer has not been changed in the meantime
          if (globeLayer() === layer) {
            this.viewer.terrainProvider = terrainProvider;
          }
        });
        break;
      }
    }
  }

  setupEventListeners() {
    // the particles stay visible while the camera moves: the trails are reprojected every frame
    // (see trailDraw.frag) and new particles spawn in the current view
    let cameraMoving = false;
    this.camera.moveStart.addEventListener(() => {
      cameraMoving = true;
    });

    this.camera.moveEnd.addEventListener(() => {
      cameraMoving = false;
      this.updateViewerParameters();
      if (this.particleSystem) {
        this.particleSystem.applyViewerParameters(this.viewerParameters);
      }
    });

    let lastRedistribution = performance.now();

    let resized = false;
    window.addEventListener("resize", () => {
      resized = true;
      this.removePrimitives();
    });

    this.scene.preRender.addEventListener(() => {
      if (resized && this.particleSystem) {
        this.particleSystem.canvasResize(this.scene.context);
        resized = false;
        this.addPrimitives();
        this.particlesVisible = undefined;
      }
      if (this.particleSystem) {
        this.fadeParticlesByHeight();
        if (cameraMoving) {
          this.updateViewerParameters();
          // the follow camera moves all the time and never ends a move: redistribute the particles regularly
          const now = performance.now();
          if (now - lastRedistribution > 1000) {
            lastRedistribution = now;
            this.particleSystem.applyViewerParameters(this.viewerParameters);
          }
        }
        this.particleSystem.particlesRendering.updateReprojection(this.camera);
      }
    });

    // show the wind file that applies to the current time; after the end of the data the last one stays
    this.viewer.clock.onTick.addEventListener((clock) => {
      const file = windFileAt(Cesium.JulianDate.toIso8601(clock.currentTime, 0));
      if (file && file !== this.dataFile) {
        this.showWindData(file);
      }
    });
  }
}
