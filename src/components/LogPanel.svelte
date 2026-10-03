<script>
  import { ClipboardList } from '@lucide/svelte';
  import { t } from '../i18n.svelte.js';
  import { ui } from '../lib/stores.svelte.js';
</script>

<footer class="log" class:open={ui.logOpen}>
  <button class="log-toggle" onclick={() => ui.logOpen = !ui.logOpen}>
    <ClipboardList size={14} />
    <span>{t('log.title')}</span>
    <span class="spacer"></span>
    <span class="chev">{ui.logOpen ? '▼' : '▲'}</span>
  </button>
  {#if ui.logOpen}
    <div class="log-body">
      {#if ui.logLines.length === 0}
        <div class="log-empty">{t('log.empty')}</div>
      {:else}
        {#each ui.logLines as line}
          <div class="log-line">{line}</div>
        {/each}
      {/if}
    </div>
  {:else}
    <div class="log-last">{ui.logLines[ui.logLines.length - 1] ?? ''}</div>
  {/if}
</footer>

<style>
  .log {
    background: var(--bg-1);
    border-top: 1px solid var(--border);
    display: flex; flex-direction: column;
    max-height: 250px;
    transition: max-height 0.15s;
  }
  .log:not(.open) { max-height: 35px; }
  .log-toggle {
    display: flex; align-items: center; gap: 8px;
    background: transparent; border: none;
    color: var(--fg-1); padding: 8px 12px;
    cursor: pointer; font-size: 12px;
    height: 35px; font-family: inherit;
  }
  .log-toggle .spacer { flex: 1; }
  .log-toggle .chev { color: var(--fg-2); font-size: 10px; }
  .log-body {
    overflow-y: auto; padding: 0 12px 8px;
    font-family: 'Cascadia Mono', Consolas, monospace;
    font-size: 11px; color: var(--fg-1);
  }
  .log-line { padding: 1px 0; }
  .log-empty { color: var(--fg-2); font-style: italic; }
  .log-last {
    padding: 0 12px 8px;
    font-family: 'Cascadia Mono', Consolas, monospace;
    font-size: 11px; color: var(--fg-2);
    white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis;
  }
</style>