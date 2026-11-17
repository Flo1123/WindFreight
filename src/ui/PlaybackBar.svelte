<script>
  import { app } from "../app.js";
  import { live } from "../state.svelte.js";
  import { speedMultipliers } from "../settings.js";
  import { formatDate, formatNumber, formatDuration } from "./format.js";

  const { changeSpeed } = $props();

  let width = $state(600);
  let hoverX = $state(null);
  let dragging = false;
  const ribbonHeight = 26;

  const x = (seconds) => (seconds / live.duration) * width;
  const progress = $derived(live.elapsed / live.duration);
  const startMs = $derived(Date.parse(live.startIso));

  // how strongly the kite pulled along the voyage (share of engine thrust), one bar per 3 px
  const ribbon = $derived.by(() => {
    live.trackVersion;
    const track = app.simulation.track;
    if (!track.length) return "";
    const buckets = Math.max(1, Math.floor(width / 3));
    const sums = new Array(buckets).fill(0);
    const counts = new Array(buckets).fill(0);
    for (const sample of track) {
      const b = Math.min(buckets - 1, Math.floor((sample.time / live.duration) * buckets));
      sums[b] += sample.currentKiteEfficiency;
      counts[b]++;
    }
    let path = "";
    const w = width / buckets;
    for (let b = 0; b < buckets; b++) {
      if (!counts[b]) continue;
      const h = Math.max(0, Math.min(1, sums[b] / counts[b] / 100)) * ribbonHeight;
      if (h < 0.5) continue;
      path += `M${(b * w).toFixed(1)} ${ribbonHeight}h${(w - 1).toFixed(1)}v${(-h).toFixed(1)}h${(-(w - 1)).toFixed(1)}Z`;
    }
    return path;
  });

  // midnights (UTC) during the voyage, labelled so that labels do not overlap
  const days = $derived.by(() => {
    const dayMs = 86400000;
    const pxPerDay = (dayMs / 1000 / live.duration) * width;
    const every = Math.max(1, Math.ceil(30 / pxPerDay));
    const result = [];
    for (let t = Math.ceil(startMs / dayMs) * dayMs, i = 0; t <= startMs + live.duration * 1000; t += dayMs, i++) {
      const date = new Date(t);
      result.push({ ms: t, x: x((t - startMs) / 1000), label: i % every === 0 ? String(date.getUTCDate()) : null, month: date.getUTCDate() === 1 });
    }
    return result;
  });

  function secondsAt(event, element) {
    const rect = element.getBoundingClientRect();
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * live.duration;
  }

  function onPointerDown(event) {
    dragging = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    app.simulation.seek(secondsAt(event, event.currentTarget));
  }

  function onPointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    hoverX = event.clientX - rect.left;
    if (dragging) app.simulation.seek(secondsAt(event, event.currentTarget));
  }

  function togglePlay() {
    live.playing ? app.simulation.pause() : app.simulation.play();
  }
</script>

<section class="bar glass">
  <div class="controls">
    <button class="icon-button" onclick={() => app.simulation.seek(0)} aria-label="Back to departure" title="Back to departure (Home)">
      <svg viewBox="0 0 24 24" fill="currentColor"
        ><path d="M6 5h2v14H6zM19 5.5v13a.5.5 0 0 1-.77.42L9 12.42a.5.5 0 0 1 0-.84l9.23-6.5a.5.5 0 0 1 .77.42Z" /></svg
      >
    </button>
    <button class="play" onclick={togglePlay} aria-label={live.playing ? "Pause" : "Play"} title="{live.playing ? 'Pause' : 'Play'} (Space)">
      <svg viewBox="0 0 24 24" fill="currentColor">
        {#if live.playing}<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />{:else}<path
            d="M8 5.6v12.8a.6.6 0 0 0 .92.5l10-6.4a.6.6 0 0 0 0-1L8.92 5.1A.6.6 0 0 0 8 5.6Z"
          />{/if}
      </svg>
    </button>
    <div class="speed" title="Simulated time per real second: {formatDuration(live.multiplier)} (↑ / ↓)">
      <button class="icon-button small" onclick={() => changeSpeed(-1)} disabled={live.multiplier === speedMultipliers[0]} aria-label="Slower">−</button>
      <span class="num">{formatNumber(live.multiplier)}×</span>
      <button
        class="icon-button small"
        onclick={() => changeSpeed(1)}
        disabled={live.multiplier === speedMultipliers[speedMultipliers.length - 1]}
        aria-label="Faster">+</button
      >
    </div>
  </div>

  <div
    class="timeline"
    bind:clientWidth={width}
    role="slider"
    tabindex="0"
    aria-label="Voyage time"
    aria-valuemin="0"
    aria-valuemax={Math.round(live.duration)}
    aria-valuenow={Math.round(live.elapsed)}
    aria-valuetext={formatDate(live.startIso, live.elapsed)}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={(e) => {
      dragging = false;
      if (e.pointerType !== "mouse") hoverX = null;
    }}
    onpointerleave={() => (hoverX = null)}
  >
    <svg {width} height="48">
      <rect x="0" y="0" width={x(live.computedUntil)} height={ribbonHeight} class="computed" />
      <path d={ribbon} class="ribbon" />
      <line x1="0" x2={width} y1={ribbonHeight + 0.5} y2={ribbonHeight + 0.5} class="baseline" />
      <rect x="0" y={ribbonHeight - 1} width={progress * width} height="3" class="progress" />
      {#each days as day (day.ms)}
        <line x1={day.x} x2={day.x} y1={ribbonHeight + 2} y2={ribbonHeight + (day.label ? 7 : 5)} class="tick" />
        {#if day.label}
          <text x={day.x} y={ribbonHeight + 19} class="day" class:month={day.month}
            >{day.month ? formatDate(new Date(day.ms).toISOString(), 0, false) : day.label}</text
          >
        {/if}
      {/each}
      {#if hoverX !== null}
        <line x1={hoverX} x2={hoverX} y1="0" y2={ribbonHeight} class="hover" />
      {/if}
      <line x1={progress * width} x2={progress * width} y1="-4" y2={ribbonHeight + 2} class="playhead" />
      <circle cx={progress * width} cy={ribbonHeight} r="5" class="knob" />
    </svg>
    {#if hoverX !== null}
      <div class="tooltip num" style="left: {Math.max(40, Math.min(width - 40, hoverX))}px">
        {formatDate(live.startIso, (hoverX / width) * live.duration)}
      </div>
    {/if}
    {#if live.loadErrorAt !== null}
      <div class="buffering error">
        Could not load the wind data for {formatDate(live.startIso, live.loadErrorAt)}. Press play or click the timeline to try again.
      </div>
    {:else if live.buffering}
      <div class="buffering">Computing the voyage up to here, {Math.round((live.computedUntil / Math.max(live.elapsed, 1)) * 100)} %</div>
    {/if}
  </div>

  <div class="time">
    <b class="num">{formatDate(live.startIso, live.elapsed)} <span class="utc">UTC</span></b>
    <small class="num"
      >Day {Math.floor(live.elapsed / 86400) + 1} of {Math.ceil(live.duration / 86400)}, arrives {formatDate(live.startIso, live.duration, false)}</small
    >
  </div>
</section>

<style>
  .bar {
    grid-column: 1 / -1;
    grid-row: -2;
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 10px 18px 10px 12px;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
  }

  .play {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: var(--ink);
    color: #0a1f3a;
    cursor: pointer;
  }

  .play:hover {
    background: #fff;
  }

  .play svg {
    width: 22px;
    height: 22px;
  }

  .speed {
    display: flex;
    align-items: center;
    margin-left: 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
  }

  .speed span {
    min-width: 64px;
    text-align: center;
    font-weight: 500;
  }

  .small {
    width: 28px;
    height: 30px;
    font-size: 17px;
  }

  .timeline {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 48px;
    margin-top: 10px;
    cursor: pointer;
    touch-action: none;
    border-radius: 4px;
  }

  .timeline svg {
    display: block;
    overflow: visible;
  }

  .computed {
    fill: rgba(160, 200, 235, 0.05);
  }

  .ribbon {
    fill: var(--kite);
    opacity: 0.75;
  }

  .baseline {
    stroke: var(--line-strong);
  }

  .progress {
    fill: var(--save);
  }

  .tick {
    stroke: var(--faint);
  }

  .day {
    fill: var(--faint);
    font-family: var(--font-num);
    font-size: 11px;
    text-anchor: middle;
  }

  .day.month {
    fill: var(--muted);
  }

  .hover {
    stroke: var(--line-strong);
  }

  .playhead {
    stroke: var(--ink);
    stroke-width: 1.5;
  }

  .knob {
    fill: var(--ink);
    stroke: #0a1f3a;
    stroke-width: 2;
  }

  .tooltip {
    position: absolute;
    bottom: calc(100% + 6px);
    transform: translateX(-50%);
    padding: 3px 8px;
    border-radius: 6px;
    background: var(--glass-strong);
    border: 1px solid var(--line);
    white-space: nowrap;
    font-size: 12px;
    pointer-events: none;
  }

  .buffering {
    position: absolute;
    left: 0;
    bottom: calc(100% + 6px);
    color: var(--kite);
    font-size: 12px;
    pointer-events: none;
  }

  .buffering.error {
    color: var(--warn);
  }

  .time {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    min-width: 170px;
  }

  .time b {
    font-size: 19px;
    font-weight: 600;
  }

  .time b span {
    color: var(--muted);
    font-size: 13px;
    font-weight: 500;
  }

  .time small {
    color: var(--muted);
    font-size: 12px;
  }

  @media (max-width: 900px), (max-height: 560px) {
    .bar {
      flex-wrap: wrap;
      gap: 6px 12px;
      padding: 8px 12px;
    }

    .timeline {
      order: 3;
      flex-basis: 100%;
    }

    .controls {
      gap: 2px;
    }

    .speed {
      margin-left: 4px;
    }

    .speed span {
      min-width: 52px;
    }

    .time {
      margin-left: auto;
      min-width: 0;
    }

    .time b {
      font-size: 16px;
    }

    .utc {
      display: none;
    }
  }
</style>
