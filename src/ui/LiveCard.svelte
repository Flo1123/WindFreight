<script>
  import { app } from "../app.js";
  import { live } from "../state.svelte.js";
  import { shipOptions } from "../settings.js";
  import { formatMass, formatNumber, formatForce } from "./format.js";
  import Compass from "./Compass.svelte";
  import { layout } from "./layout.svelte.js";

  let expanded = $state(!layout.compact);
  let chartWidth = $state(300);
  const chartHeight = 64;
  // y of the scale line; the scale label sits above it
  const chartTop = 14;

  let card;
  let valuesButton;
  let valuesPopover;

  const s = $derived(live.sample);
  // no sample yet, or the shown one is from before the current time (still being computed)
  const stale = $derived(!s || live.buffering);
  const atStart = $derived(s && live.elapsed === 0 && !live.playing);

  // round the chart scale up to 1, 2, 2.5 or 5 × 10^n, so it changes only in steps and not with every new sample
  function niceCeil(value) {
    const power = 10 ** Math.floor(Math.log10(value));
    return [1, 2, 2.5, 5, 10].find((m) => m * power >= value) * power;
  }

  // the values list opens below the button, or above it when the card sits in the lower half of the screen (compact layout)
  function placeValues(event) {
    if (event.newState !== "open") return;
    const cardRect = card.getBoundingClientRect();
    const buttonRect = valuesButton.getBoundingClientRect();
    const below = cardRect.top + cardRect.height / 2 < window.innerHeight / 2;
    valuesPopover.style.left = cardRect.left + "px";
    valuesPopover.style.width = cardRect.width + "px";
    valuesPopover.style.top = below ? buttonRect.bottom + 6 + "px" : "auto";
    valuesPopover.style.bottom = below ? "auto" : window.innerHeight - cardRect.top + 6 + "px";
    valuesPopover.style.maxHeight = (below ? window.innerHeight - buttonRect.bottom : cardRect.top) - 22 + "px";
  }

  const flymodeText = {
    "figure-eight": "Flying figure eights",
    "sine wave": "Flying a sine wave",
    "not flying": "Kite is down",
  };

  // cumulative CO2 savings over the computed part of the voyage
  const chart = $derived.by(() => {
    live.trackVersion;
    const track = app.simulation.track;
    if (track.length < 2) return null;
    // at least 1 t, so the scale does not start at a few kg
    const max = niceCeil(Math.max(track[track.length - 1].co2Savings, 1000));
    const points = Math.min(track.length, 240);
    let line = "";
    for (let i = 0; i < points; i++) {
      const sample = track[Math.round((i / (points - 1)) * (track.length - 1))];
      const x = (sample.time / live.duration) * chartWidth;
      const y = chartHeight - (sample.co2Savings / max) * (chartHeight - chartTop);
      line += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    const lastX = (track[track.length - 1].time / live.duration) * chartWidth;
    return { line, area: line + `L${lastX.toFixed(1)} ${chartHeight}L0 ${chartHeight}Z`, max };
  });
</script>

<section class="card glass" aria-live="off" bind:this={card}>
  <header>
    <h2>Live</h2>
    {#if !stale}
      <span class="flymode" class:active={s.active}>{flymodeText[s.flymode]}</span>
    {:else}
      <span class="flymode">Computing…</span>
    {/if}
    <button class="icon-button values-button" popovertarget="all-values" disabled={!s} bind:this={valuesButton} aria-label="All values" title="All values">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
        ><path d="M9 7h11M9 12h11M9 17h11" /><circle cx="4.5" cy="7" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="17" r="1" /></svg
      >
    </button>
    <button class="icon-button" onclick={() => (expanded = !expanded)} aria-label={expanded ? "Collapse live values" : "Expand live values"}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        {#if expanded}<path d="M6 9l6 6 6-6" />{:else}<path d="M6 15l6-6 6 6" />{/if}
      </svg>
    </button>
  </header>

  {#if atStart}
    <p class="hint">
      <span class="play-icon"
        ><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.6v12.8a.6.6 0 0 0 .92.5l10-6.4a.6.6 0 0 0 0-1L8.92 5.1A.6.6 0 0 0 8 5.6Z" /></svg></span
      >
      Press play to start the voyage and see how much fuel and CO₂ the kite saves.
    </p>
  {:else}
    <div class="kpis" class:stale>
      <div class="kpi save">
        <span>Fuel saved</span>
        <b class="num">{s ? formatMass(s.fuelSavings) : "–"}</b>
        <small class="num">{s ? formatNumber(s.overallKiteEfficiency, 1) + " % of the voyage so far" : ""}</small>
      </div>
      <div class="kpi save">
        <span>CO₂ avoided</span>
        <b class="num">{s ? formatMass(s.co2Savings) : "–"}</b>
        <small class="num">{s ? "of " + formatMass(s.fuelConsumptionWithoutKite * shipOptions.co2PerFuel) + " without kite" : ""}</small>
      </div>
    </div>
  {/if}

  {#if expanded}
    <div class="now" class:stale>
      <div class="pull">
        <span>Kite pull now</span>
        <b class="num">{s ? formatNumber(s.currentKiteEfficiency, 1) + " %" : "–"}</b>
        <div class="bar"><div style="width: {s ? Math.min(100, s.currentKiteEfficiency) : 0}%"></div></div>
        <small>of the engine's thrust</small>
      </div>
    </div>

    {#if s}
      <div class:stale>
        <Compass shipDirection={s.shipDirection} windDirection={s.windDirection} windSpeed={s.windSpeed} shipSpeed={s.shipSpeed} kiteActive={s.active} />
      </div>
    {/if}

    <figure class="chart" bind:clientWidth={chartWidth}>
      <figcaption>CO₂ avoided over the voyage</figcaption>
      <svg width={chartWidth} height={chartHeight} role="img" aria-label="Cumulative CO₂ avoided over the voyage">
        <line x1="0" x2={chartWidth} y1={chartHeight - 0.5} y2={chartHeight - 0.5} class="axis" />
        {#if chart}
          <line x1="0" x2={chartWidth} y1={chartTop + 0.5} y2={chartTop + 0.5} class="scale-line" />
          <text x="0" y={chartTop - 4} class="scale num">{(chart.max / 1000).toLocaleString("en")} t</text>
          <path d={chart.area} class="area" />
          <path d={chart.line} class="line" />
        {/if}
        <line x1={(live.elapsed / live.duration) * chartWidth} x2={(live.elapsed / live.duration) * chartWidth} y1="0" y2={chartHeight} class="playhead" />
      </svg>
    </figure>
  {/if}

  <!-- popover: drawn above everything, so the card's scrolling does not cut it off -->
  <div id="all-values" class="values" popover bind:this={valuesPopover} onbeforetoggle={placeValues}>
    <h3>All values</h3>
    {#if s}
      <dl class="num" class:stale>
        <dt>Engine force without kite</dt>
        <dd>{formatForce(s.motorForceWithoutKite)}</dd>
        <dt>Engine force with kite</dt>
        <dd>{formatForce(s.motorForceWithKite)}</dd>
        <dt>Kite force</dt>
        <dd>{formatForce(s.kiteForce)}</dd>
        <dt>Fuel without kite</dt>
        <dd>{formatMass(s.fuelConsumptionWithoutKite)}</dd>
        <dt>Fuel with kite</dt>
        <dd>{formatMass(s.fuelConsumptionWithKite)}</dd>
        <dt>Wind, blowing to</dt>
        <dd>{formatNumber(s.windDirection)}° at {formatNumber(s.windSpeed, 1)} m/s</dd>
        <dt>Apparent wind angle</dt>
        <dd>{formatNumber(s.shipWindDirection)}° at {formatNumber(s.shipWindSpeed, 1)} m/s</dd>
        <dt>Ship</dt>
        <dd>{formatNumber(s.shipDirection)}° at {formatNumber(s.shipSpeed, 2)} m/s</dd>
        <dt>Position</dt>
        <dd>{formatNumber(s.latitude, 2)}°, {formatNumber(s.longitude, 2)}°</dd>
      </dl>
    {/if}
  </div>
</section>

<style>
  .card {
    flex: 0 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--line-strong) transparent;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 10px 16px 16px;
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-right: -8px;
  }

  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .flymode {
    margin-left: auto;
    padding: 2px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--muted);
    font-size: 13px;
  }

  .flymode.active {
    color: var(--kite);
    border-color: rgba(243, 180, 80, 0.4);
    background: rgba(243, 180, 80, 0.08);
  }

  .kpis {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }

  .kpi {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .kpi span,
  .pull span {
    color: var(--muted);
  }

  .kpi b {
    font-size: 30px;
    font-weight: 600;
    line-height: 1.15;
    color: var(--save);
  }

  small {
    color: var(--faint);
    font-size: 12px;
  }

  .stale {
    opacity: 0.45;
  }

  .pull {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    row-gap: 5px;
  }

  .pull b {
    color: var(--kite);
    font-size: 18px;
    font-weight: 600;
  }

  .bar {
    grid-column: 1 / -1;
    height: 5px;
    border-radius: 3px;
    background: rgba(160, 200, 235, 0.14);
    overflow: hidden;
  }

  .bar div {
    height: 100%;
    background: var(--kite);
    border-radius: 3px;
  }

  .chart {
    margin: 0;
  }

  .chart figcaption {
    color: var(--muted);
    margin-bottom: 6px;
  }

  .chart svg {
    display: block;
    overflow: visible;
  }

  .axis {
    stroke: var(--line-strong);
  }

  .area {
    fill: rgba(79, 209, 181, 0.16);
  }

  .line {
    fill: none;
    stroke: var(--save);
    stroke-width: 1.6;
    stroke-linejoin: round;
  }

  .playhead {
    stroke: var(--ink);
    stroke-width: 1;
    stroke-dasharray: 2 3;
  }

  .scale-line {
    stroke: var(--line);
    stroke-dasharray: 2 3;
  }

  .scale {
    fill: var(--faint);
    font-size: 11px;
  }

  .hint {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 0;
    color: var(--muted);
  }

  .play-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--ink);
    color: #0a1f3a;
  }

  .play-icon svg {
    width: 15px;
    height: 15px;
  }

  /* the two icon buttons sit closer together than the header items */
  .values-button {
    margin-right: -8px;
  }

  .values {
    inset: auto;
    margin: 0;
    padding: 12px 16px 14px;
    overflow-y: auto;
    box-sizing: border-box;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--glass-strong);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    box-shadow: 0 12px 40px rgba(2, 10, 22, 0.45);
    color: var(--ink);
    font-family: var(--font);
  }

  .values h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  dl {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    margin: 10px 0 0;
    font-size: 13px;
  }

  dt {
    color: var(--muted);
  }

  dd {
    margin: 0;
    text-align: right;
  }

  @media (max-width: 900px), (max-height: 560px) {
    .card {
      gap: 10px;
      padding: 8px 14px 12px;
    }

    .kpi b {
      font-size: 22px;
    }
  }
</style>
