<script>
  import { ui } from '../lib/stores.svelte.js';
</script>

{#if ui.progress.visible}
  <div class="progress-bar">
    <div class="progress-fill" style="width: {(ui.progress.value * 100).toFixed(1)}%"></div>
    <div class="progress-label">
      <span>{ui.progress.label}</span>
      <span>{(ui.progress.value * 100).toFixed(0)}%</span>
    </div>
  </div>
{/if}

<style>
  .progress-bar {
    position: relative; height: 4px;
    background: var(--bg-2);
    border-top: 1px solid var(--border);
    overflow: visible;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-dim), var(--accent));
    transition: width 0.2s ease-out;
    box-shadow: 0 0 8px var(--accent-dim);
  }
  .progress-label {
    position: absolute; top: -22px;
    left: 12px; right: 12px;
    display: flex; justify-content: space-between;
    font-size: 11px; color: var(--fg-1);
    pointer-events: none;
  }
</style>