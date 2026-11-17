<script>
  import { untrack } from "svelte";
  import { app } from "./app.js";
  import { settings, live, globeLayer, shipType } from "./state.svelte.js";
  import { speedMultipliers } from "./settings.js";
  import Globe from "./ui/Globe.svelte";
  import RouteChip from "./ui/RouteChip.svelte";
  import SidePanel from "./ui/SidePanel.svelte";
  import LiveCard from "./ui/LiveCard.svelte";
  import PlaybackBar from "./ui/PlaybackBar.svelte";
  import Shortcuts from "./ui/Shortcuts.svelte";
  import CameraButtons from "./ui/CameraButtons.svelte";
  import { layout, hud } from "./ui/layout.svelte.js";

  let panelOpen = $state(!layout.compact);
  let shortcutsOpen = $state(false);
  let hudElement = $state();

  // wide layout: the columns cover the sides and the playback bar the bottom;
  // compact layout: the panels cover the top and bottom, the settings drawer is ignored (it is closed again to look at the globe)
  hud.insets = () => {
    const insets = { left: 0, right: 0, top: 0, bottom: 0 };
    if (!hudElement) return insets;
    const { width, height } = hudElement.getBoundingClientRect();
    const panels = hudElement.querySelectorAll(layout.compact ? ":scope > .left > *, :scope > .bar" : ":scope > .left > *, :scope > .right > *, :scope > .bar");
    for (const panel of panels) {
      const rect = panel.getBoundingClientRect();
      if (layout.compact || rect.width > width * 0.6) {
        if (rect.top + rect.height / 2 < height / 2) insets.top = Math.max(insets.top, rect.bottom);
        else insets.bottom = Math.max(insets.bottom, height - rect.top);
      } else if (rect.left + rect.width / 2 < width / 2) {
        insets.left = Math.max(insets.left, rect.right);
      } else {
        insets.right = Math.max(insets.right, width - rect.left);
      }
    }
    return insets;
  };

  // voyage settings in the address bar, so a voyage can be shared or bookmarked (read in state.svelte.js)
  $effect(() => {
    const params = new URLSearchParams({
      from: settings.start,
      to: settings.destination,
      ship: shipType().name,
      speed: settings.speedKnots,
      kite: settings.kiteSize,
      date: settings.startDate,
      time: String(settings.startHour).padStart(2, "0"),
    });
    history.replaceState(null, "", "?" + params);
  });

  // the first view of the route, once the panels exist and can be measured
  $effect(() => {
    if (hudElement) untrack(() => app.ship.showRoute());
  });

  // runs fn once the value of key() has been stable for `delay` ms, skipping the value the simulation started with
  function onSettled(key, fn, delay) {
    let applied;
    let timer;
    $effect(() => {
      const value = key();
      if (!live.ready) return;
      if (applied === undefined) {
        applied = value;
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (value !== applied) {
          applied = value;
          untrack(fn);
        }
      }, delay);
    });
  }

  // every voyage setting restarts the simulation
  onSettled(
    () =>
      JSON.stringify([
        settings.start,
        settings.destination,
        settings.shipTypeIndex,
        settings.speedKnots,
        settings.kiteSize,
        settings.startDate,
        settings.startHour,
      ]),
    () => app.ship.reset(),
    150,
  );
  onSettled(
    () => settings.layer,
    () => app.wind3D.setGlobeLayer(),
    0,
  );
  onSettled(
    () => JSON.stringify([settings.showParticles, settings.maxParticles, settings.speedFactor, settings.lineWidth, settings.opacity]),
    () => app.wind3D.applyParticleSettings(),
    0,
  );
  onSettled(
    () => settings.follow,
    () => app.ship.setFollow(settings.follow),
    0,
  );
  const hour = 3600;

  function changeSpeed(direction) {
    const index = speedMultipliers.indexOf(live.multiplier) + direction;
    live.multiplier = speedMultipliers[Math.max(0, Math.min(speedMultipliers.length - 1, index))];
  }

  function onKeydown(event) {
    if (event.key === "Escape") {
      if (shortcutsOpen) shortcutsOpen = false;
      else if (layout.compact) panelOpen = false;
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest("input, select, textarea")) return;
    if (!live.ready) return;

    const { simulation } = app;
    // lower case, so the letter shortcuts also work with Caps Lock or Shift
    switch (event.key.length === 1 ? event.key.toLowerCase() : event.key) {
      case " ":
        live.playing ? simulation.pause() : simulation.play();
        break;
      case "ArrowLeft":
        simulation.seek(live.elapsed - 6 * hour);
        break;
      case "ArrowRight":
        simulation.seek(live.elapsed + 6 * hour);
        break;
      case "ArrowUp":
        changeSpeed(1);
        break;
      case "ArrowDown":
        changeSpeed(-1);
        break;
      case "Home":
        simulation.seek(0);
        break;
      case "c":
        settings.follow = !settings.follow;
        break;
      case "r":
        app.ship.showRoute();
        break;
      case "p":
        panelOpen = !panelOpen;
        break;
      case "v":
        if (!document.fullscreenElement) document.documentElement.requestFullscreen();
        else document.exitFullscreen();
        break;
      case "?":
        shortcutsOpen = !shortcutsOpen;
        break;
      default:
        return;
    }
    event.preventDefault();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<Globe />

<!-- until the first wind field is on the globe -->
{#if !live.windFile}
  <div class="loader glass" role="status">
    <span class="spinner"></span>
    Loading wind data…
  </div>
{/if}

{#if live.ready}
  <div class="hud" class:compact={layout.compact} bind:this={hudElement}>
    <div class="left">
      <RouteChip />
      <LiveCard />
    </div>
    <div class="right" class:open={panelOpen}>
      <SidePanel bind:open={panelOpen} onShortcuts={() => (shortcutsOpen = true)} />
    </div>
    <div class="camera">
      <CameraButtons />
    </div>
    <PlaybackBar {changeSpeed} />
  </div>
{/if}

{#if globeLayer().attribution && import.meta.env.VITE_CARTO_KEY}
  <div class="attribution">
    {#each globeLayer().attribution as credit (credit.href)}
      <a href={credit.href} target="_blank" rel="noopener">{credit.text}</a>
    {/each}
  </div>
{/if}

{#if shortcutsOpen}
  <Shortcuts onclose={() => (shortcutsOpen = false)} />
{/if}

<style>
  .loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-radius: 999px;
    color: var(--muted);
    pointer-events: none;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--line-strong);
    border-top-color: var(--save);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* map attribution in the strip below the playback bar (Cesium's own link sits on the left) */
  .attribution {
    position: absolute;
    right: 16px;
    bottom: 3px;
    display: flex;
    gap: 8px;
    font-size: 11px;
  }

  .attribution a {
    color: var(--muted);
    text-decoration: none;
  }

  .attribution a:hover {
    color: var(--ink);
  }

  /* the HUD lets clicks through to the globe, only its panels take them */
  .hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: grid;
    grid-template-columns: minmax(0, 320px) 1fr minmax(0, 340px);
    grid-template-rows: minmax(0, 1fr) auto;
    gap: var(--gap);
    padding: var(--gap) var(--gap) 22px;
  }

  /* only the panels take clicks, the gaps between them belong to the globe */
  .hud > :global(*),
  .left,
  .right {
    pointer-events: none;
  }

  .left > :global(*),
  .right > :global(*),
  .camera > :global(*),
  .hud > :global(.bar) {
    pointer-events: auto;
  }

  .left,
  .right {
    grid-row: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }

  .left {
    grid-column: 1;
  }

  .right {
    grid-column: 3;
  }

  .camera {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
    align-self: end;
  }

  /* phones and half-width windows: chip on top, live values above the playback bar, settings as a drawer */
  .hud.compact {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 10px;
    padding: 10px 10px 20px;
  }

  .compact .left {
    grid-column: 1;
    grid-row: 1;
    justify-content: space-between;
  }

  .compact .left > :global(.chip) {
    max-width: calc(100% - 56px);
  }

  .compact .left > :global(.card) {
    width: min(100%, 380px);
  }

  .compact .right {
    grid-column: 1;
    grid-row: 1;
    justify-self: end;
    align-self: start;
    z-index: 1;
  }

  /* below the settings button */
  .compact .camera {
    grid-column: 1;
    grid-row: 1;
    align-self: start;
    margin-top: 56px;
  }

  .compact .right.open {
    align-self: stretch;
    width: min(100%, 380px);
  }
</style>
