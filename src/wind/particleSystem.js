import { ParticlesComputing } from "./particlesComputing.js";
import { ParticlesRendering } from "./particlesRendering.js";

export class ParticleSystem {
  constructor(context, data, userInput, viewerParameters) {
    this.context = context;
    this.data = data;
    this.userInput = userInput;
    this.viewerParameters = viewerParameters;

    this.particlesComputing = new ParticlesComputing(this.context, this.data, this.userInput, this.viewerParameters);
    this.particlesRendering = new ParticlesRendering(this.context, this.userInput, this.viewerParameters, this.particlesComputing);
  }

  // frees the GPU textures and framebuffers; the primitives must be removed from the scene separately
  destroyTextures() {
    this.particlesComputing.destroyParticlesTextures();
    Object.keys(this.particlesComputing.windTextures).forEach((key) => {
      this.particlesComputing.windTextures[key].destroy();
    });

    Object.keys(this.particlesRendering.framebuffers).forEach((key) => {
      this.particlesRendering.framebuffers[key].destroy();
    });
  }

  canvasResize(context) {
    this.destroyTextures();

    this.context = context;
    this.particlesComputing = new ParticlesComputing(this.context, this.data, this.userInput, this.viewerParameters);
    this.particlesRendering = new ParticlesRendering(this.context, this.userInput, this.viewerParameters, this.particlesComputing);
  }

  applyViewerParameters(viewerParameters) {
    Object.keys(viewerParameters).forEach((key) => {
      this.viewerParameters[key] = viewerParameters[key];
    });
    // redistribute the particles in the new view, but keep the trails so they fade out smoothly
    this.particlesComputing.destroyParticlesTextures();
    this.particlesComputing.createParticlesTextures(this.context, this.userInput, this.viewerParameters);
  }
}
