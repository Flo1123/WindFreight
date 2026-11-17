import * as Cesium from "cesium";

import { Util } from "./util.js";
import { CustomPrimitive } from "./customPrimitive.js";
import segmentDrawVert from "./glsl/segmentDraw.vert?raw";
import segmentDrawFrag from "./glsl/segmentDraw.frag?raw";
import fullscreenVert from "./glsl/fullscreen.vert?raw";
import trailDrawFrag from "./glsl/trailDraw.frag?raw";
import screenDrawFrag from "./glsl/screenDraw.frag?raw";

export class ParticlesRendering {
  constructor(context, userInput, viewerParameters, particlesComputing) {
    this.reprojection = {
      inverseViewProjection: new Cesium.Matrix4(),
      viewProjection: new Cesium.Matrix4(),
      previousViewProjection: new Cesium.Matrix4(),
      cameraPosition: new Cesium.Cartesian3(),
      previousCameraPosition: undefined,
      cameraPositionScaled: new Cesium.Cartesian3(),
      cameraEllipsoidC: 0.0,
      cameraDelta: new Cesium.Cartesian3(),
      ellipsoidRadii: Cesium.Cartesian3.add(
        Cesium.Ellipsoid.WGS84.radii,
        new Cesium.Cartesian3(userInput.particleHeight, userInput.particleHeight, userInput.particleHeight),
        new Cesium.Cartesian3(),
      ),
    };
    this.createRenderingTextures(context);
    this.createRenderingFramebuffers(context);
    this.createRenderingPrimitives(context, userInput, viewerParameters, particlesComputing);
  }

  // call once per frame before rendering, see trailDraw.frag
  updateReprojection(camera) {
    const r = this.reprojection;

    Cesium.Matrix4.clone(r.viewProjection, r.previousViewProjection);
    const rotation = Cesium.Matrix4.fromRotation(Cesium.Matrix4.getMatrix3(camera.viewMatrix, new Cesium.Matrix3()));
    Cesium.Matrix4.multiply(camera.frustum.projectionMatrix, rotation, r.viewProjection);
    Cesium.Matrix4.inverse(r.viewProjection, r.inverseViewProjection);

    Cesium.Cartesian3.clone(camera.positionWC, r.cameraPosition);
    if (!Cesium.defined(r.previousCameraPosition)) {
      // first frame: nothing to reproject from
      r.previousCameraPosition = Cesium.Cartesian3.clone(r.cameraPosition);
      Cesium.Matrix4.clone(r.viewProjection, r.previousViewProjection);
    }
    Cesium.Cartesian3.subtract(r.cameraPosition, r.previousCameraPosition, r.cameraDelta);
    Cesium.Cartesian3.clone(r.cameraPosition, r.previousCameraPosition);

    Cesium.Cartesian3.divideComponents(r.cameraPosition, r.ellipsoidRadii, r.cameraPositionScaled);
    r.cameraEllipsoidC = Cesium.Cartesian3.magnitudeSquared(r.cameraPositionScaled) - 1.0;
  }

  createRenderingTextures(context) {
    const colorTextureOptions = {
      context: context,
      width: context.drawingBufferWidth,
      height: context.drawingBufferHeight,
      pixelFormat: Cesium.PixelFormat.RGBA,
      pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE,
    };
    const depthTextureOptions = {
      context: context,
      width: context.drawingBufferWidth,
      height: context.drawingBufferHeight,
      pixelFormat: Cesium.PixelFormat.DEPTH_COMPONENT,
      pixelDatatype: Cesium.PixelDatatype.UNSIGNED_INT,
    };

    this.textures = {
      segmentsColor: Util.createTexture(colorTextureOptions),
      segmentsDepth: Util.createTexture(depthTextureOptions),

      currentTrailsColor: Util.createTexture(colorTextureOptions),
      currentTrailsDepth: Util.createTexture(depthTextureOptions),

      nextTrailsColor: Util.createTexture(colorTextureOptions),
      nextTrailsDepth: Util.createTexture(depthTextureOptions),
    };
  }

  createRenderingFramebuffers(context) {
    this.framebuffers = {
      segments: Util.createFramebuffer(context, this.textures.segmentsColor, this.textures.segmentsDepth),
      currentTrails: Util.createFramebuffer(context, this.textures.currentTrailsColor, this.textures.currentTrailsDepth),
      nextTrails: Util.createFramebuffer(context, this.textures.nextTrailsColor, this.textures.nextTrailsDepth),
    };
  }

  createSegmentsGeometry(userInput) {
    const repeatVertex = 6;

    let st = [];
    for (let s = 0; s < userInput.particlesTextureSize; s++) {
      for (let t = 0; t < userInput.particlesTextureSize; t++) {
        for (let i = 0; i < repeatVertex; i++) {
          st.push(s / userInput.particlesTextureSize);
          st.push(t / userInput.particlesTextureSize);
        }
      }
    }
    st = new Float32Array(st);

    let normal = [];
    const pointToUse = [-1, 0, 1];
    const offsetSign = [-1, 1];
    for (let i = 0; i < userInput.maxParticles; i++) {
      for (let j = 0; j < pointToUse.length; j++) {
        for (let k = 0; k < offsetSign.length; k++) {
          normal.push(pointToUse[j]);
          normal.push(offsetSign[k]);
          normal.push(0);
        }
      }
    }
    normal = new Float32Array(normal);

    const indexSize = 12 * userInput.maxParticles;
    const vertexIndexes = new Uint32Array(indexSize);
    for (let i = 0, j = 0, vertex = 0; i < userInput.maxParticles; i++) {
      vertexIndexes[j++] = vertex + 0;
      vertexIndexes[j++] = vertex + 1;
      vertexIndexes[j++] = vertex + 2;

      vertexIndexes[j++] = vertex + 2;
      vertexIndexes[j++] = vertex + 1;
      vertexIndexes[j++] = vertex + 3;

      vertexIndexes[j++] = vertex + 2;
      vertexIndexes[j++] = vertex + 4;
      vertexIndexes[j++] = vertex + 3;

      vertexIndexes[j++] = vertex + 4;
      vertexIndexes[j++] = vertex + 3;
      vertexIndexes[j++] = vertex + 5;

      vertex += repeatVertex;
    }

    const geometry = new Cesium.Geometry({
      attributes: new Cesium.GeometryAttributes({
        st: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 2,
          values: st,
        }),
        normal: new Cesium.GeometryAttribute({
          componentDatatype: Cesium.ComponentDatatype.FLOAT,
          componentsPerAttribute: 3,
          values: normal,
        }),
      }),
      indices: vertexIndexes,
    });

    return geometry;
  }

  createRenderingPrimitives(context, userInput, viewerParameters, particlesComputing) {
    const that = this;
    this.primitives = {
      segments: new CustomPrimitive({
        commandType: "Draw",
        attributeLocations: {
          st: 0,
          normal: 1,
        },
        geometry: this.createSegmentsGeometry(userInput),
        primitiveType: Cesium.PrimitiveType.TRIANGLES,
        uniformMap: {
          previousParticlesPosition: function () {
            return particlesComputing.particlesTextures.previousParticlesPosition;
          },
          currentParticlesPosition: function () {
            return particlesComputing.particlesTextures.currentParticlesPosition;
          },
          postProcessingPosition: function () {
            return particlesComputing.particlesTextures.postProcessingPosition;
          },
          particlesSpeed: function () {
            return particlesComputing.particlesTextures.particlesSpeed;
          },
          aspect: function () {
            return context.drawingBufferWidth / context.drawingBufferHeight;
          },
          pixelSize: function () {
            return viewerParameters.pixelSize;
          },
          lineWidth: function () {
            return userInput.lineWidth;
          },
          particleHeight: function () {
            return userInput.particleHeight;
          },
        },
        vertexShaderSource: new Cesium.ShaderSource({
          sources: [segmentDrawVert],
        }),
        fragmentShaderSource: new Cesium.ShaderSource({
          sources: [segmentDrawFrag],
        }),
        rawRenderState: Util.createRawRenderState({
          // undefined value means let Cesium deal with it
          viewport: undefined,
          depthTest: {
            enabled: true,
          },
          depthMask: true,
        }),
        framebuffer: this.framebuffers.segments,
        autoClear: true,
      }),

      trails: new CustomPrimitive({
        commandType: "Draw",
        attributeLocations: {
          position: 0,
          st: 1,
        },
        geometry: Util.getFullscreenQuad(),
        primitiveType: Cesium.PrimitiveType.TRIANGLES,
        uniformMap: {
          segmentsColorTexture: function () {
            return that.textures.segmentsColor;
          },
          segmentsDepthTexture: function () {
            return that.textures.segmentsDepth;
          },
          currentTrailsColor: function () {
            return that.framebuffers.currentTrails.getColorTexture(0);
          },
          fadeOpacity: function () {
            return userInput.fadeOpacity;
          },
          inverseViewProjection: function () {
            return that.reprojection.inverseViewProjection;
          },
          previousViewProjection: function () {
            return that.reprojection.previousViewProjection;
          },
          cameraPositionScaled: function () {
            return that.reprojection.cameraPositionScaled;
          },
          cameraEllipsoidC: function () {
            return that.reprojection.cameraEllipsoidC;
          },
          cameraDelta: function () {
            return that.reprojection.cameraDelta;
          },
          ellipsoidRadii: function () {
            return that.reprojection.ellipsoidRadii;
          },
        },
        // LOG_DEPTH_READ_ONLY prevents Cesium from writing log depth because the depth here is written manually
        vertexShaderSource: new Cesium.ShaderSource({
          defines: [],
          sources: [fullscreenVert],
        }),
        fragmentShaderSource: new Cesium.ShaderSource({
          defines: ["LOG_DEPTH_READ_ONLY"],
          sources: [trailDrawFrag],
        }),
        rawRenderState: Util.createRawRenderState({
          viewport: undefined,
          depthTest: {
            enabled: true,
            func: Cesium.DepthFunction.ALWAYS, // always pass depth test for full control of depth information
          },
          depthMask: true,
        }),
        framebuffer: this.framebuffers.nextTrails,
        autoClear: true,
        preExecute: function () {
          // swap framebuffers before binding
          const temp = that.framebuffers.currentTrails;
          that.framebuffers.currentTrails = that.framebuffers.nextTrails;
          that.framebuffers.nextTrails = temp;

          // keep the framebuffers up to date
          that.primitives.trails.commandToExecute.framebuffer = that.framebuffers.nextTrails;
          that.primitives.trails.clearCommand.framebuffer = that.framebuffers.nextTrails;
        },
      }),

      screen: new CustomPrimitive({
        commandType: "Draw",
        attributeLocations: {
          position: 0,
          st: 1,
        },
        geometry: Util.getFullscreenQuad(),
        primitiveType: Cesium.PrimitiveType.TRIANGLES,
        uniformMap: {
          trailsColorTexture: function () {
            return that.framebuffers.nextTrails.getColorTexture(0);
          },
          trailsDepthTexture: function () {
            return that.framebuffers.nextTrails.depthTexture;
          },
          opacity: function () {
            return userInput.opacity;
          },
        },
        // LOG_DEPTH_READ_ONLY prevents Cesium from writing log depth because the depth here is written manually
        vertexShaderSource: new Cesium.ShaderSource({
          defines: [],
          sources: [fullscreenVert],
        }),
        fragmentShaderSource: new Cesium.ShaderSource({
          defines: ["LOG_DEPTH_READ_ONLY"],
          sources: [screenDrawFrag],
        }),
        rawRenderState: Util.createRawRenderState({
          viewport: undefined,
          depthTest: {
            enabled: false,
          },
          depthMask: true,
          blending: {
            enabled: true,
          },
        }),
        framebuffer: undefined, // undefined value means let Cesium deal with it
      }),
    };
  }
}
