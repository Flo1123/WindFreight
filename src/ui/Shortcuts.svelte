<script>
  const { onclose } = $props();

  const shortcuts = [
    ["Space", "Play or pause"],
    ["← / →", "6 hours back or forward"],
    ["↑ / ↓", "Faster or slower"],
    ["Home", "Back to departure"],
    ["C", "Follow the ship on or off"],
    ["R", "Show the whole route"],
    ["P", "Show or hide the panel"],
    ["V", "Full screen"],
    ["?", "Show this list"],
  ];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={onclose}>
  <div class="dialog glass" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title" onclick={(e) => e.stopPropagation()}>
    <header>
      <h2 id="shortcuts-title">Keyboard shortcuts</h2>
      <button class="icon-button" onclick={onclose} aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </header>
    <dl>
      {#each shortcuts as [key, action] (key)}
        <dt><kbd>{key}</kbd></dt>
        <dd>{action}</dd>
      {/each}
    </dl>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(2, 10, 22, 0.4);
    z-index: 10;
  }

  .dialog {
    width: min(360px, calc(100% - 32px));
    padding: 12px 20px 20px;
    background: var(--glass-strong);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-right: -10px;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px 16px;
    margin: 14px 0 0;
    align-items: center;
  }

  dd {
    margin: 0;
    color: var(--muted);
  }

  kbd {
    display: inline-block;
    min-width: 22px;
    padding: 2px 8px;
    border-radius: 6px;
    border: 1px solid var(--line-strong);
    border-bottom-width: 2px;
    font-family: var(--font-num);
    text-align: center;
  }
</style>
