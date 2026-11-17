<script>
  import { app } from "../app.js";
  import { settings } from "../state.svelte.js";
</script>

<div class="camera" role="group" aria-label="Camera">
  <button
    class="glass"
    class:active={settings.follow}
    aria-pressed={settings.follow}
    onclick={() => (settings.follow = !settings.follow)}
    title="Follow the ship (C)"
    aria-label="Follow the ship"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
      <circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" />
    </svg>
  </button>
  <button class="glass" onclick={() => app.ship.showRoute()} title="Show the whole route (R)" aria-label="Show the whole route">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </svg>
  </button>
</div>

<style>
  .camera {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border-radius: 50%;
    color: var(--muted);
    cursor: pointer;
  }

  button:hover {
    color: var(--ink);
  }

  button.active {
    color: #0a1f3a;
    background: var(--ink);
    border-color: var(--ink);
  }

  svg {
    width: 20px;
    height: 20px;
  }
</style>
