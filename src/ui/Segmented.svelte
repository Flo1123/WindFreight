<script>
  // options: [{ value, label, disabled?, title? }]
  let { options, value = $bindable(), label } = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === option.value}
      class:active={value === option.value}
      disabled={option.disabled}
      title={option.title}
      onclick={() => (value = option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    padding: 3px;
    gap: 2px;
    border-radius: var(--radius-control);
    background: rgba(2, 12, 26, 0.45);
    border: 1px solid var(--line);
  }

  button {
    flex: 1;
    min-width: 0;
    padding: 6px 4px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: var(--muted);
    font-family: var(--font-num);
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    white-space: nowrap;
  }

  button:hover:not(:disabled):not(.active) {
    color: var(--ink);
  }

  button.active {
    background: rgba(160, 200, 235, 0.16);
    color: var(--ink);
  }

  button:disabled {
    color: var(--faint);
    opacity: 0.45;
    cursor: not-allowed;
    text-decoration: line-through;
  }
</style>
