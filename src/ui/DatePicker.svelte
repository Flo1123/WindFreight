<script>
  // month calendar; only days in `available` (YYYYMMDD strings) can be picked, months without data are skipped
  let { value = $bindable(), available, isLate = () => false, label } = $props();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const availableSet = $derived(new Set(available));
  // months that have data, as "YYYY-MM", in order
  const months = $derived([...new Set(available.map((d) => d.slice(0, 4) + "-" + d.slice(4, 6)))].sort());

  let shown = $state(value.slice(0, 7));
  const monthIndex = $derived(months.indexOf(shown));

  const days = $derived.by(() => {
    const [year, month] = shown.split("-").map(Number);
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    // Monday = 0
    const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
    const cells = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= count; day++) {
      const iso = shown + "-" + String(day).padStart(2, "0");
      cells.push({ day, iso, enabled: availableSet.has(iso.replaceAll("-", "")) });
    }
    return cells;
  });

  function showMonth(step) {
    shown = months[monthIndex + step];
  }
</script>

<div class="calendar" role="group" aria-label={label}>
  <div class="head">
    <button type="button" class="icon-button nav" onclick={() => showMonth(-1)} disabled={monthIndex <= 0} aria-label="Previous month">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M15 6l-6 6 6 6" /></svg>
    </button>
    <span>{monthNames[parseInt(shown.slice(5, 7), 10) - 1]} {shown.slice(0, 4)}</span>
    <button type="button" class="icon-button nav" onclick={() => showMonth(1)} disabled={monthIndex >= months.length - 1} aria-label="Next month">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
    </button>
  </div>
  <div class="grid">
    {#each weekdays as weekday (weekday)}
      <span class="weekday">{weekday}</span>
    {/each}
    {#each days as cell, i (i)}
      {#if cell}
        <button
          type="button"
          class="day num"
          class:selected={cell.iso === value}
          class:late={cell.enabled && isLate(cell.iso)}
          disabled={!cell.enabled}
          aria-pressed={cell.iso === value}
          aria-label={cell.day +
            " " +
            monthNames[parseInt(shown.slice(5, 7), 10) - 1] +
            (cell.enabled && isLate(cell.iso) ? ", arrives after the end of the wind data" : "")}
          onclick={() => (value = cell.iso)}
        >
          {cell.day}
        </button>
      {:else}
        <span></span>
      {/if}
    {/each}
  </div>
</div>

<style>
  .calendar {
    padding: 6px 8px 8px;
    border-radius: var(--radius-control);
    background: rgba(2, 12, 26, 0.45);
    border: 1px solid var(--line);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .head span {
    font-weight: 600;
  }

  .nav {
    width: 30px;
    height: 30px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 2px;
  }

  .weekday {
    padding: 2px 0 4px;
    color: var(--faint);
    font-size: 12px;
    text-align: center;
  }

  .day {
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
  }

  .day:hover:not(:disabled):not(.selected) {
    background: rgba(160, 200, 235, 0.12);
  }

  /* a small dot under the date instead of a colour, so long voyages do not paint the whole month */
  .day.late {
    position: relative;
  }

  .day.late::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: 3px;
    width: 4px;
    height: 4px;
    margin-left: -2px;
    border-radius: 50%;
    background: var(--kite);
  }

  .day.late.selected::after {
    background: #0a1f3a;
  }

  .day.selected {
    background: var(--ink);
    color: #0a1f3a;
    font-weight: 600;
  }

  .day:disabled {
    color: var(--faint);
    opacity: 0.4;
    cursor: default;
  }
</style>
