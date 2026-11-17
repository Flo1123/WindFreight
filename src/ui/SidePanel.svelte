<script>
  import { settings, routeKey, destinationsFor, speedsFor, shipType, shipSpeed, startDateIso } from "../state.svelte.js";
  import { ports, portNames, routes, shipTypes, shipSpeeds, startHours, globeLayers, particleCounts, windFileDates, kiteOptions } from "../settings.js";
  import { windDataEndIso } from "../wind/wind3D.js";
  import DatePicker from "./DatePicker.svelte";
  import { formatDate, formatDuration, formatNumber } from "./format.js";
  import Segmented from "./Segmented.svelte";
  import Slider from "./Slider.svelte";
  import { layout } from "./layout.svelte.js";

  let { open = $bindable(), onShortcuts } = $props();
  let tab = $state("setup");

  const route = $derived(routes[routeKey()]);
  const distance = $derived(route[route.length - 1][1]);
  const duration = $derived(distance / shipSpeed());
  const departureIso = $derived(startDateIso());
  // after the end of the wind data the last wind field is used for the rest of the voyage
  const dataEndIso = windDataEndIso();
  const secondsWithoutWind = $derived((Date.parse(departureIso) + duration * 1000 - Date.parse(dataEndIso)) / 1000);
  const arrivesAfterData = (date) => Date.parse(date + departureIso.slice(10)) + duration * 1000 > Date.parse(dataEndIso);
  const validSpeeds = $derived(speedsFor(settings.shipTypeIndex));

  function setStart(port) {
    settings.start = port;
    if (!destinationsFor(port).includes(settings.destination)) {
      settings.destination = destinationsFor(port)[0];
    }
  }

  function swap() {
    [settings.start, settings.destination] = [settings.destination, settings.start];
  }

  function setShipType(index) {
    settings.shipTypeIndex = index;
    const speeds = speedsFor(index);
    if (!speeds.includes(settings.speedKnots)) {
      settings.speedKnots = speeds[speeds.length - 1];
    }
  }

  function showTab(name) {
    tab = name;
    open = true;
  }
</script>

{#if layout.compact && !open}
  <button class="open-button glass" onclick={() => (open = true)} aria-label="Open voyage and view settings" title="Settings (P)">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      ><path d="M4 7h10m4 0h2M4 17h4m4 0h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg
    >
  </button>
{:else}
  <section class="panel glass" class:closed={!open}>
    <header>
      <div class="tabs" role="tablist">
        <button
          role="tab"
          id="tab-setup"
          aria-controls="panel-body"
          aria-selected={open && tab === "setup"}
          class:active={open && tab === "setup"}
          onclick={() => showTab("setup")}>Voyage</button
        >
        <button
          role="tab"
          id="tab-view"
          aria-controls="panel-body"
          aria-selected={open && tab === "view"}
          class:active={open && tab === "view"}
          onclick={() => showTab("view")}>View</button
        >
      </div>
      <button class="icon-button" onclick={() => (open = !open)} aria-label={open ? "Close panel" : "Open panel"} title="Toggle panel (P)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
          {#if layout.compact}<path d="M6 6l12 12M18 6 6 18" />{:else if open}<path d="M6 15l6-6 6 6" />{:else}<path d="M6 9l6 6 6-6" />{/if}
        </svg>
      </button>
    </header>

    {#if open}
      <div class="body" id="panel-body" role="tabpanel" aria-labelledby={tab === "setup" ? "tab-setup" : "tab-view"}>
        {#if tab === "setup"}
          <div class="group">
            <h3>Route</h3>
            <div class="route-row">
              <label class="field">
                <span>From</span>
                <select value={settings.start} onchange={(e) => setStart(e.currentTarget.value)}>
                  {#each ports as port (port)}
                    <option value={port}>{portNames[port]}</option>
                  {/each}
                </select>
              </label>
              <button
                class="icon-button swap"
                onclick={swap}
                disabled={!(settings.destination + settings.start in routes)}
                aria-label="Swap start and destination"
                title="Swap direction"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
                  ><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4" /></svg
                >
              </button>
              <label class="field">
                <span>To</span>
                <select bind:value={settings.destination}>
                  {#each destinationsFor(settings.start) as port (port)}
                    <option value={port}>{portNames[port]}</option>
                  {/each}
                </select>
              </label>
            </div>
            <p class="note num">
              {formatNumber(distance / 1852)} nautical miles, {formatDuration(duration)} at sea
            </p>
          </div>

          <div class="group">
            <h3>Departure</h3>
            <div class="departure">
              <DatePicker label="Departure date" bind:value={settings.startDate} available={windFileDates} isLate={arrivesAfterData} />
              <Segmented
                label="Departure time (UTC)"
                bind:value={settings.startHour}
                options={startHours.map((h) => ({ value: h, label: String(h).padStart(2, "0") + ":00" }))}
              />
            </div>
            <p class="note">Arrives {formatDate(departureIso, duration)} UTC</p>
            {#if secondsWithoutWind > 0}
              <p class="warning">
                The wind data ends on {formatDate(dataEndIso)}. The last {formatDuration(secondsWithoutWind)} of the voyage use the last available wind field.
              </p>
            {:else if windFileDates.some((d) => arrivesAfterData(d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6, 8)))}
              <p class="note"><i class="late-dot"></i>Departures on these days arrive after the end of the wind data.</p>
            {/if}
          </div>

          <div class="group">
            <h3>Ship</h3>
            <label class="field">
              <span>Size</span>
              <select value={settings.shipTypeIndex} onchange={(e) => setShipType(parseInt(e.currentTarget.value, 10))}>
                {#each shipTypes as type, index (type.name)}
                  <option value={index}>{type.name} TEU</option>
                {/each}
              </select>
            </label>
            <div class="field">
              <span>Speed (knots)</span>
              <Segmented
                label="Ship speed in knots"
                bind:value={settings.speedKnots}
                options={shipSpeeds.map((s) => ({
                  value: s,
                  label: String(s),
                  disabled: !validSpeeds.includes(s),
                  title: validSpeeds.includes(s) ? undefined : "No consumption data for this ship size",
                }))}
              />
            </div>
            <p class="note num">
              Burns {formatNumber(shipType().fuelConsumption[shipSpeeds.indexOf(settings.speedKnots)], 1)} t of fuel per day without kite
            </p>
          </div>

          <div class="group">
            <h3>Kite</h3>
            <Slider
              label="Area"
              bind:value={settings.kiteSize}
              min={kiteOptions.minKiteSize}
              max={kiteOptions.maxKiteSize}
              step={kiteOptions.kiteSizeStep}
              format={(v) => v.toLocaleString("en") + " m²"}
            />
          </div>
        {:else}
          <div class="group">
            <h3>Map</h3>
            <div class="layers" role="radiogroup" aria-label="Map">
              {#each globeLayers as layer (layer.name)}
                <label class="layer" class:offline={layer.offline}>
                  <input type="radio" name="layer" value={layer.name} bind:group={settings.layer} disabled={layer.offline} />
                  <span>{layer.label}</span>
                  {#if layer.offline}<em title="NOAA's server no longer serves this layer for January 2024">offline</em>{/if}
                  {#if layer.type === "Carto" && !import.meta.env.VITE_CARTO_KEY}<em title="Set VITE_CARTO_KEY in .env.local">needs key</em>{/if}
                </label>
              {/each}
            </div>
          </div>

          <div class="group">
            <div class="toggle-row">
              <h3>Wind particles</h3>
              <label class="switch">
                <input type="checkbox" bind:checked={settings.showParticles} aria-label="Show wind particles" />
                <span></span>
              </label>
            </div>
            {#if settings.showParticles}
              <div class="field">
                <span>Count</span>
                <Segmented
                  label="Particle count"
                  bind:value={settings.maxParticles}
                  options={particleCounts.map((n) => ({ value: n, label: Math.round(n / 1000) + "k" }))}
                />
              </div>
              <Slider label="Speed" bind:value={settings.speedFactor} min={0.5} max={8} step={0.5} format={(v) => v.toFixed(1) + "×"} />
              <Slider label="Line width" bind:value={settings.lineWidth} min={0.5} max={4} step={0.25} format={(v) => v.toFixed(2) + " px"} />
              <Slider label="Opacity" bind:value={settings.opacity} min={0.1} max={1} step={0.05} format={(v) => Math.round(v * 100) + " %"} />
            {/if}
          </div>

          <button class="shortcuts" onclick={onShortcuts}>Keyboard shortcuts <kbd>?</kbd></button>
        {/if}
      </div>
    {/if}
  </section>
{/if}

<style>
  .open-button {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    padding: 0;
    border-radius: 50%;
    cursor: pointer;
    color: var(--ink);
  }

  .open-button svg {
    width: 22px;
    height: 22px;
  }

  .panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 0 1 auto;
    overflow: hidden;
  }

  .panel > * {
    flex: none;
  }

  .panel > .body {
    flex: 0 1 auto;
    min-height: 0;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 8px 8px 10px;
  }

  .panel:not(.closed) header {
    border-bottom: 1px solid var(--line);
  }

  .tabs {
    display: flex;
    gap: 4px;
  }

  .tabs button {
    padding: 6px 12px;
    border: 0;
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--muted);
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
  }

  .tabs button:hover {
    color: var(--ink);
  }

  .tabs button.active {
    color: var(--ink);
    background: rgba(160, 200, 235, 0.12);
  }

  .body {
    overflow-y: auto;
    padding: 4px 16px 16px;
    scrollbar-width: thin;
    scrollbar-color: var(--line-strong) transparent;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 0;
  }

  .group + .group {
    border-top: 1px solid var(--line);
  }

  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .field > span {
    color: var(--muted);
  }

  select {
    width: 100%;
    box-sizing: border-box;
    height: 36px;
    padding: 0 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: rgba(2, 12, 26, 0.45);
    cursor: pointer;
  }

  select {
    appearance: none;
    padding-right: 28px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2392a9c1' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M7 10l5 5 5-5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 16px;
  }

  select:hover {
    border-color: var(--line-strong);
  }

  option {
    background: #0a1f3a;
  }

  .route-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: end;
    gap: 4px;
  }

  .swap {
    margin-bottom: 1px;
  }

  .departure {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .note {
    margin: 0;
    color: var(--muted);
  }

  /* same dot as on the late days in DatePicker */
  .late-dot {
    display: inline-block;
    width: 4px;
    height: 4px;
    margin: 0 8px 2px 2px;
    border-radius: 50%;
    background: var(--kite);
    vertical-align: middle;
  }

  .warning {
    margin: 0;
    padding: 8px 10px;
    border-radius: var(--radius-control);
    background: rgba(255, 138, 107, 0.1);
    border: 1px solid rgba(255, 138, 107, 0.3);
    color: #ffc2b2;
  }

  .layers {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .layer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 8px;
    border-radius: var(--radius-control);
    cursor: pointer;
  }

  .layer:hover:not(.offline) {
    background: rgba(160, 200, 235, 0.08);
  }

  .layer input {
    accent-color: var(--save);
    margin: 0;
  }

  .layer.offline {
    color: var(--faint);
    cursor: not-allowed;
  }

  .layer em {
    margin-left: auto;
    padding: 1px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    font-style: normal;
    font-size: 12px;
  }

  .toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .switch {
    position: relative;
    width: 38px;
    height: 22px;
    cursor: pointer;
  }

  .switch input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }

  .switch span {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: rgba(160, 200, 235, 0.2);
    transition: background 0.15s;
  }

  .switch span::after {
    content: "";
    position: absolute;
    top: 3px;
    left: 3px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--ink);
    transition: transform 0.15s;
  }

  .switch input:checked + span {
    background: var(--save);
  }

  .switch input:checked + span::after {
    transform: translateX(16px);
  }

  .switch input:focus-visible + span {
    outline: 2px solid var(--save);
    outline-offset: 2px;
  }

  .shortcuts {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-top: 6px;
    padding: 9px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--muted);
    cursor: pointer;
  }

  .shortcuts:hover {
    color: var(--ink);
    border-color: var(--line-strong);
  }

  kbd {
    padding: 1px 7px;
    border-radius: 5px;
    border: 1px solid var(--line-strong);
    font-family: var(--font-num);
  }
</style>
