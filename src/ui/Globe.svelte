<script>
  import { onMount } from "svelte";
  import { app } from "../app.js";
  import { live } from "../state.svelte.js";
  import { Wind3D } from "../wind/wind3D.js";
  import { Kite } from "../kite.js";
  import { Simulation } from "../simulation.js";
  import { Ship } from "../ship.js";

  let container;

  onMount(() => {
    // the order matters: Simulation uses wind3D's clock, Ship's constructor already uses all three
    app.wind3D = new Wind3D(container);
    app.kite = new Kite();
    app.simulation = new Simulation();
    app.ship = new Ship();
    live.ready = true;

    // for debugging in the browser console (dev server only)
    if (import.meta.env.DEV) {
      window.app = app;
    }
  });
</script>

<div class="globe" bind:this={container}></div>

<style>
  .globe {
    position: absolute;
    inset: 0;
  }
</style>
