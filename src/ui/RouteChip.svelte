<script>
  import { settings, live } from "../state.svelte.js";
  import { portNames, forecastHours } from "../settings.js";
  import { windFileIso } from "../wind/wind3D.js";
  import { formatDate } from "./format.js";
</script>

<div class="chip glass">
  <div class="route">
    <span>{portNames[settings.start]}</span>
    <svg viewBox="0 0 24 12" aria-hidden="true"><path d="M1 6h20m-5-4 4 4-4 4" /></svg>
    <span>{portNames[settings.destination]}</span>
  </div>
  <div class="facts num">
    <span>{settings.speedKnots} kn</span>
    <span>Kite {settings.kiteSize.toLocaleString("en")} m²</span>
    {#if live.windFile}
      <span class="wind" title="NOAA GFS wind field shown on the globe: model run and forecast hour">
        GFS {formatDate(windFileIso(live.windFile))} +{parseInt(forecastHours, 10)} h
      </span>
    {/if}
  </div>
</div>

<style>
  .chip {
    flex: none;
    align-self: flex-start;
    padding: 12px 18px 11px;
    border-radius: 16px;
  }

  .route {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 21px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.1;
  }

  .route svg {
    width: 24px;
    height: 12px;
    fill: none;
    stroke: var(--save);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .facts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 5px;
    color: var(--muted);
    font-size: 13px;
  }

  .wind {
    color: var(--faint);
  }

  @media (max-width: 900px), (max-height: 560px) {
    .chip {
      padding: 9px 14px 8px;
    }

    .route {
      font-size: 17px;
      gap: 8px;
    }

    .facts {
      font-size: 12px;
      gap: 2px 10px;
    }
  }
</style>
