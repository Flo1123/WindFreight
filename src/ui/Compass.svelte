<script>
  // north-up compass: ship heading, true wind and the wind the kite feels (apparent wind); directions = where it blows to
  import { apparentWind } from "../kite.js";

  const { shipDirection, windDirection, windSpeed, shipSpeed, kiteActive } = $props();

  // apparent wind = true wind minus the ship's own motion
  const apparent = $derived(apparentWind({ windSpeed, windDirection, shipSpeed, shipDirection }));

  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
</script>

<figure class="compass">
  <svg
    viewBox="-60 -60 120 120"
    role="img"
    aria-label="Ship heading {Math.round(shipDirection)}°, wind blowing to {Math.round(windDirection)}°, apparent wind blowing to {Math.round(
      apparent.direction,
    )}°"
  >
    <circle r="56" class="ring" />
    {#each ticks as t (t)}
      <line y1="-56" y2={t % 90 === 0 ? -49 : t % 30 === 0 ? -52 : -54} transform="rotate({t})" class="tick" class:major={t % 90 === 0} />
    {/each}
    <text y="-39" class="cardinal">N</text>
    <text x="41" y="1" class="cardinal">E</text>
    <text y="42" class="cardinal">S</text>
    <text x="-41" y="1" class="cardinal">W</text>

    <!-- true wind: a long arrow across the dial -->
    <g transform="rotate({windDirection})" class="wind">
      <line y1="34" y2="-30" />
      <path d="M0 -36 L-5 -27 L5 -27 Z" />
    </g>

    <!-- apparent wind -->
    <g transform="rotate({apparent.direction})" class="apparent" class:active={kiteActive}>
      <line y1="26" y2="-22" />
      <path d="M0 -28 L-5 -19 L5 -19 Z" />
    </g>

    <!-- ship hull pointing along its heading -->
    <g transform="rotate({shipDirection})" class="ship">
      <path d="M0 -16 C5 -10 5.5 -2 5 12 L-5 12 C-5.5 -2 -5 -10 0 -16 Z" />
    </g>
  </svg>
  <figcaption>
    <span><i class="key ship-key"></i>Ship <b class="num">{Math.round(shipDirection)}°</b></span>
    <span><i class="key wind-key"></i>Wind <b class="num">{windSpeed.toFixed(1)} m/s</b></span>
    <span><i class="key apparent-key" class:active={kiteActive}></i>On kite <b class="num">{apparent.speed.toFixed(1)} m/s</b></span>
  </figcaption>
</figure>

<style>
  .compass {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 0;
  }

  svg {
    width: 118px;
    height: 118px;
    flex: none;
    overflow: visible;
  }

  .ring {
    fill: rgba(2, 12, 26, 0.45);
    stroke: var(--line-strong);
  }

  .tick {
    stroke: var(--faint);
    stroke-width: 1;
  }

  .tick.major {
    stroke: var(--muted);
    stroke-width: 1.5;
  }

  .cardinal {
    fill: var(--muted);
    font-size: 9px;
    font-weight: 600;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .wind line {
    stroke: var(--muted);
    stroke-width: 1.5;
  }

  .wind path {
    fill: var(--muted);
  }

  .apparent line {
    stroke: var(--faint);
    stroke-width: 2.5;
    stroke-linecap: round;
  }

  .apparent path {
    fill: var(--faint);
  }

  .apparent.active line {
    stroke: var(--kite);
  }

  .apparent.active path {
    fill: var(--kite);
  }

  .ship path {
    fill: var(--ink);
    stroke: #0a1f3a;
    stroke-width: 1.2;
  }

  figcaption {
    display: flex;
    flex-direction: column;
    gap: 5px;
    color: var(--muted);
    font-size: 13px;
  }

  figcaption span {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  b {
    margin-left: auto;
    padding-left: 8px;
    color: var(--ink);
    font-weight: 500;
  }

  .key {
    width: 12px;
    height: 3px;
    border-radius: 2px;
    flex: none;
  }

  .ship-key {
    background: var(--ink);
    height: 6px;
    width: 6px;
    margin: 0 3px;
  }

  .wind-key {
    background: var(--muted);
    height: 2px;
  }

  .apparent-key {
    background: var(--faint);
  }

  .apparent-key.active {
    background: var(--kite);
  }
</style>
