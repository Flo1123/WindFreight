import * as Cesium from "cesium";

import { app } from "./app.js";
import { fileOptions, shipOptions, kiteOptions, routes, portNames, displayOptions } from "./settings.js";
import { settings, live, routeKey, shipSpeed, startDateIso } from "./state.svelte.js";
import { apparentWind } from "./kite.js";
import { hud } from "./ui/layout.svelte.js";

// same colours as the UI tokens in style.css
const colors = {
  ink: Cesium.Color.fromCssColorString("#e9f1f8"),
  ahead: Cesium.Color.fromCssColorString("#92a9c1").withAlpha(0.6),
  travelled: Cesium.Color.fromCssColorString("#cfdbe8"),
  kite: Cesium.Color.fromCssColorString("#f3b450"),
  navy: Cesium.Color.fromCssColorString("#0a1f3a"),
};

// kite pull (share of engine thrust, %) at which the route is fully amber
const fullPull = 25;

const nearOnly = new Cesium.DistanceDisplayCondition(0, displayOptions.modelDistance);
const farOnly = new Cesium.DistanceDisplayCondition(displayOptions.modelDistance, Number.MAX_VALUE);
// markers stay visible over terrain but are still hidden behind the globe from far away
const markerDepthTest = 2.0e6;

function drawIcon(size, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  draw(canvas.getContext("2d"));
  return canvas;
}

// arrow pointing up (north when rotated by the heading)
const shipIcon = drawIcon(64, (ctx) => {
  ctx.beginPath();
  ctx.moveTo(32, 8);
  ctx.lineTo(48, 54);
  ctx.lineTo(32, 45);
  ctx.lineTo(16, 54);
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#0a1f3a";
  ctx.stroke();
  ctx.fillStyle = "#e9f1f8";
  ctx.fill();
});

const pulseIcon = drawIcon(64, (ctx) => {
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#e9f1f8";
  ctx.stroke();
});

// tow line from the bottom centre (the ship) to a kite at the top
const kiteIcon = drawIcon(64, (ctx) => {
  ctx.strokeStyle = "#f3b450";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(32, 64);
  ctx.lineTo(32, 22);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(32, 2);
  ctx.lineTo(43, 12);
  ctx.lineTo(32, 22);
  ctx.lineTo(21, 12);
  ctx.closePath();
  ctx.fillStyle = "#f3b450";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0a1f3a";
  ctx.stroke();
});

export class Ship {
  constructor() {
    const { viewer } = app.wind3D;

    this.entities = [];
    this.travelledPrimitive = null;
    this.following = false;

    // Cesium's own double-click tracking would fight the follow camera
    viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    viewer.scene.preRender.addEventListener(() => this.update());

    // the first showRoute() comes from App.svelte, once the panels around the globe can be measured
    this.initialize();
  }

  initialize() {
    const { wind3D, simulation } = app;

    this.shipSpeed = shipSpeed();

    this.route = routes[routeKey()];

    this.pathPositions = [];

    this.start = Cesium.JulianDate.fromIso8601(startDateIso());
    this.end = Cesium.JulianDate.addSeconds(this.start, this.route[this.route.length - 1][1] / this.shipSpeed, new Cesium.JulianDate());

    wind3D.viewer.clock.startTime = this.start.clone();
    wind3D.viewer.clock.stopTime = this.end.clone();
    wind3D.viewer.clock.currentTime = this.start.clone();
    wind3D.viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
    wind3D.viewer.clock.shouldAnimate = false;

    this.addPositionsToProperty();

    this.kiteSample = null;
    this.samplePositions = [];
    this.travelledEnd = null;
    this.lastRedraw = 0;
    this.redrawnElapsed = -1;
    this.redrawnVersion = -1;

    this.addEntities();

    simulation.reset(this);
  }

  addPositionsToProperty() {
    this.positionProperty = new Cesium.SampledPositionProperty(Cesium.ReferenceFrame.FIXED);

    // linear: the route points are dense, and higher degrees overshoot where the point spacing changes
    this.positionProperty.setInterpolationOptions({
      interpolationDegree: 1,
      interpolationAlgorithm: Cesium.LinearApproximation,
    });

    const startDate = Cesium.JulianDate.addSeconds(this.start, -1, new Cesium.JulianDate());

    const startPosition = Cesium.Cartesian3.fromDegrees(this.route[0][0][0], this.route[0][0][1], this.route[0][0][2]);

    this.positionProperty.addSample(startDate, startPosition);

    for (let i = 0; i < this.route.length; i++) {
      const dataPoint = this.route[i];
      const time = Cesium.JulianDate.addSeconds(this.start, dataPoint[1] / this.shipSpeed, new Cesium.JulianDate());

      const cartographic = Cesium.Cartographic.fromDegrees(
        dataPoint[0][0], // Longitude
        dataPoint[0][1], // Latitude
        dataPoint[0][2], // Altitude/Height
      );

      const position = Cesium.Ellipsoid.WGS84.cartographicToCartesian(cartographic);

      this.positionProperty.addSample(time, position);

      this.pathPositions.push(position);
    }

    const endDate = Cesium.JulianDate.addSeconds(this.end, 1, new Cesium.JulianDate());

    const endPosition = this.positionProperty.getValue(this.end);

    this.positionProperty.addSample(endDate, endPosition);
  }

  positionAt(seconds) {
    return this.positionProperty.getValue(Cesium.JulianDate.addSeconds(this.start, seconds, new Cesium.JulianDate()));
  }

  addEntities() {
    const { viewer } = app.wind3D;
    const add = (entity) => {
      const added = viewer.entities.add(entity);
      this.entities.push(added);
      return added;
    };

    // the whole route, built once; the travelled part (a separate, wider primitive, see redrawRoute) is drawn over it
    add({
      polyline: {
        positions: this.pathPositions,
        width: 1.5,
        // geodesic: straight segments would dip below the globe surface and be hidden
        arcType: Cesium.ArcType.GEODESIC,
        // solid on purpose: Cesium's dash pattern is computed per short segment in screen space and breaks up along the dense route
        material: colors.ahead,
      },
    });

    // from the end of the travelled primitive (redrawn a few times per second) to the ship, every frame
    add({
      polyline: {
        positions: new Cesium.CallbackProperty((time) => {
          const ship = this.positionProperty.getValue(time);
          return this.travelledEnd && ship ? [this.travelledEnd.position, ship] : [];
        }, false),
        width: 3,
        arcType: Cesium.ArcType.GEODESIC,
        material: new Cesium.ColorMaterialProperty(new Cesium.CallbackProperty(() => this.travelledEnd?.color ?? colors.travelled, false)),
      },
    });

    for (const [port, position] of [
      [settings.start, this.pathPositions[0]],
      [settings.destination, this.pathPositions[this.pathPositions.length - 1]],
    ]) {
      add({
        position,
        point: {
          pixelSize: 7,
          color: colors.navy,
          outlineColor: colors.ink,
          outlineWidth: 2,
          disableDepthTestDistance: markerDepthTest,
        },
        label: {
          text: portNames[port],
          font: "600 13px Barlow, sans-serif",
          fillColor: colors.ink,
          showBackground: true,
          backgroundColor: colors.navy.withAlpha(0.8),
          backgroundPadding: new Cesium.Cartesian2(7, 4),
          // bottom edge above the ship marker (26 px), which sits on the port at departure and arrival
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          disableDepthTestDistance: markerDepthTest,
        },
      });
    }

    const heading = new Cesium.CallbackProperty(() => -Cesium.Math.toRadians(this.kiteSample?.shipDirection ?? 0), false);

    // far away: marker with a slow pulse, plus the kite glyph pointing downwind while the kite flies
    add({
      position: this.positionProperty,
      billboard: {
        image: pulseIcon,
        width: 44,
        height: 44,
        scale: new Cesium.CallbackProperty(() => 0.6 + ((performance.now() / 2400) % 1) * 0.9, false),
        color: new Cesium.CallbackProperty(() => colors.ink.withAlpha(0.5 * (1 - ((performance.now() / 2400) % 1))), false),
        distanceDisplayCondition: farOnly,
        disableDepthTestDistance: markerDepthTest,
      },
    });
    this.kiteGlyph = add({
      position: this.positionProperty,
      show: false,
      billboard: {
        image: kiteIcon,
        width: 40,
        height: 40,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        alignedAxis: Cesium.Cartesian3.UNIT_Z,
        rotation: new Cesium.CallbackProperty(() => -Cesium.Math.toRadians(this.kiteDirection()), false),
        distanceDisplayCondition: farOnly,
        disableDepthTestDistance: markerDepthTest,
      },
    });
    this.shipMarker = add({
      position: this.positionProperty,
      billboard: {
        image: shipIcon,
        width: 26,
        height: 26,
        alignedAxis: Cesium.Cartesian3.UNIT_Z,
        rotation: heading,
        distanceDisplayCondition: farOnly,
        disableDepthTestDistance: markerDepthTest,
      },
    });

    // close up: the models at their real size, the kite on its tow line
    this.shipEntity = add({
      position: this.positionProperty,
      model: {
        uri: fileOptions.shipDirectory,
        scale: shipOptions.realScale,
        minimumPixelSize: 24,
        distanceDisplayCondition: nearOnly,
      },
      orientation: new Cesium.VelocityOrientationProperty(this.positionProperty),
    });

    const kitePosition = new Cesium.CallbackPositionProperty((time, result) => this.kitePosition(time, result), false);
    this.kiteEntity = add({
      position: kitePosition,
      show: false,
      model: {
        uri: app.kite.model3dUrl,
        scale: new Cesium.CallbackProperty(() => (Math.sqrt(settings.kiteSize) * kiteOptions.wingspanPerSqrtArea) / kiteOptions.modelWidth, false),
        distanceDisplayCondition: nearOnly,
      },
      orientation: new Cesium.CallbackProperty((time) => {
        const position = kitePosition.getValue(time);
        if (!position) return undefined;
        return Cesium.Transforms.headingPitchRollQuaternion(position, new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(this.kiteDirection()), 0, 0));
      }, false),
      polyline: {
        positions: new Cesium.CallbackProperty((time) => {
          const ship = this.positionProperty.getValue(time);
          const kite = kitePosition.getValue(time);
          return ship && kite ? [ship, kite] : [];
        }, false),
        width: 1.2,
        arcType: Cesium.ArcType.NONE,
        material: colors.ink.withAlpha(0.85),
        distanceDisplayCondition: nearOnly,
      },
    });
  }

  // direction the kite flies to: where the apparent wind blows to
  kiteDirection() {
    return this.kiteSample ? apparentWind(this.kiteSample).direction : 0;
  }

  // kite on its tow line, downwind of the ship and at the height angle of the current flight mode
  kitePosition(time, result) {
    const ship = this.positionProperty.getValue(time);
    if (!ship) return undefined;
    const elevation = Cesium.Math.toRadians(this.kiteSample?.flymode === "figure-eight" ? kiteOptions.kiteHeightAngleLoop : kiteOptions.kiteHeightAngleSinus);
    const direction = Cesium.Math.toRadians(this.kiteDirection());
    const horizontal = kiteOptions.lineLength * Math.cos(elevation);
    const offset = new Cesium.Cartesian3(horizontal * Math.sin(direction), horizontal * Math.cos(direction), kiteOptions.lineLength * Math.sin(elevation));
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(ship);
    return Cesium.Matrix4.multiplyByPoint(enu, offset, result ?? new Cesium.Cartesian3());
  }

  // called on every tick with the current simulation sample (null while it is being computed)
  updateKite(sample) {
    if (!sample) return;
    this.kiteSample = sample;
    this.kiteEntity.show = sample.active;
    this.kiteGlyph.show = sample.active;
  }

  // the travelled part of the route, coloured by how strongly the kite pulled
  redrawRoute() {
    const { scene } = app.wind3D;
    const { track } = app.simulation;
    const elapsed = live.elapsed;

    const positions = [];
    const vertexColors = [];
    for (let i = 0; i < track.length && track[i].time <= elapsed; i++) {
      if (!this.samplePositions[i]) this.samplePositions[i] = this.positionAt(track[i].time);
      positions.push(this.samplePositions[i]);
      const pull = Math.min(1, track[i].currentKiteEfficiency / fullPull);
      vertexColors.push(Cesium.Color.lerp(colors.travelled, colors.kite, pull, new Cesium.Color()));
    }
    // the last bit up to the ship is drawn every frame by the connector entity (see addEntities)
    this.travelledEnd = positions.length ? { position: positions[positions.length - 1], color: vertexColors[vertexColors.length - 1] } : null;

    if (this.travelledPrimitive) {
      scene.primitives.remove(this.travelledPrimitive);
      this.travelledPrimitive = null;
    }
    if (positions.length >= 2) {
      this.travelledPrimitive = scene.primitives.add(
        new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({
            geometry: new Cesium.PolylineGeometry({
              positions,
              colors: vertexColors,
              colorsPerVertex: true,
              width: 3,
              arcType: Cesium.ArcType.GEODESIC,
            }),
          }),
          appearance: new Cesium.PolylineColorAppearance(),
          asynchronous: false,
        }),
      );
    }
  }

  update() {
    const now = performance.now();
    // redraw when the ship moved or when newly computed samples arrived (after scrubbing forward)
    const changed = live.elapsed !== this.redrawnElapsed || live.trackVersion !== this.redrawnVersion;
    if (changed && now - this.lastRedraw > displayOptions.routeRedrawInterval) {
      this.lastRedraw = now;
      this.redrawnElapsed = live.elapsed;
      this.redrawnVersion = live.trackVersion;
      this.redrawRoute();
    }

    if (this.following) {
      this.followShip();
    }
  }

  // follow camera: keeps the user's distance and angle (mouse wheel and drag still work) and moves with the ship
  followShip() {
    const { camera, clock } = app.wind3D.viewer;
    const target = this.positionProperty.getValue(clock.currentTime);
    if (!target) return;
    const offset = this.followOffset
      ? new Cesium.HeadingPitchRange(camera.heading, camera.pitch, Cesium.Cartesian3.magnitude(camera.position))
      : new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(displayOptions.followPitch), displayOptions.followRange);
    this.followOffset = true;
    camera.lookAt(target, offset);
  }

  setFollow(follow) {
    this.following = follow;
    this.followOffset = false;
    if (!follow) {
      app.wind3D.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }
  }

  // fly to a view of the whole route in the part of the screen the panels leave free; stops following
  showRoute() {
    const { camera, scene } = app.wind3D.viewer;
    settings.follow = false;
    this.setFollow(false);

    // free screen area in px, with room for the port labels (about 80 px wide, centred on the port)
    const insets = hud.insets();
    const padding = 64;
    const width = scene.canvas.clientWidth;
    const height = scene.canvas.clientHeight;
    const freeWidth = Math.max(100, width - insets.left - insets.right - 2 * padding);
    const freeHeight = Math.max(100, height - insets.top - insets.bottom - 2 * padding);
    // focal length in px: a point at screen distance d from the centre is seen at an angle of atan(d / focal)
    const focal = height / 2 / Math.tan(camera.frustum.fovy / 2);

    // route in a local east-north-up frame, the camera looks straight down onto it
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.BoundingSphere.fromPoints(this.pathPositions).center);
    const toLocal = Cesium.Matrix4.inverseTransformation(frame, new Cesium.Matrix4());
    const local = this.pathPositions.map((position) => Cesium.Matrix4.multiplyByPoint(toLocal, position, new Cesium.Cartesian3()));
    const xs = local.map((p) => p.x);
    const ys = local.map((p) => p.y);
    const zs = local.map((p) => p.z);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

    // lowest camera height at which every route point projects into the free area
    let cameraHeight = 0;
    for (const p of local) {
      cameraHeight = Math.max(
        cameraHeight,
        p.z + (Math.abs(p.x - centerX) * focal) / (freeWidth / 2),
        p.z + (Math.abs(p.y - centerY) * focal) / (freeHeight / 2),
      );
    }

    // move the camera so the route sits in the middle of the free area instead of the middle of the screen
    const depth = cameraHeight - (Math.min(...zs) + Math.max(...zs)) / 2;
    const shiftRight = (insets.left - insets.right) / 2;
    const shiftUp = (insets.bottom - insets.top) / 2;
    const cameraLocal = new Cesium.Cartesian3(centerX - (shiftRight * depth) / focal, centerY - (shiftUp * depth) / focal, cameraHeight);

    // direction and up from the route's frame: pitch -90° would look along the normal at the shifted camera position and undo the shift
    camera.flyTo({
      destination: Cesium.Matrix4.multiplyByPoint(frame, cameraLocal, new Cesium.Cartesian3()),
      orientation: {
        direction: Cesium.Matrix4.multiplyByPointAsVector(frame, new Cesium.Cartesian3(0, 0, -1), new Cesium.Cartesian3()),
        up: Cesium.Matrix4.multiplyByPointAsVector(frame, Cesium.Cartesian3.UNIT_Y, new Cesium.Cartesian3()),
      },
      duration: 1.5,
    });
  }

  reset() {
    const { viewer } = app.wind3D;
    for (const entity of this.entities) {
      viewer.entities.remove(entity);
    }
    this.entities = [];

    this.initialize();
    if (!this.following) this.showRoute();
  }
}
