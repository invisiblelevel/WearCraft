<script>
  import { FolderOpen, Palette, Save, Settings, Trash2, Stamp } from '@lucide/svelte';
  import { t } from '../i18n.svelte.js';
  import { pbr, ui, params, setPreset } from '../lib/stores.svelte.js';
  import { onLoadModel, onLoadPBR, onClearPBR } from '../lib/actions.svelte.js';

  let hasPbr = $derived(Object.keys(pbr.textures).length > 0);
  let isDecal = $derived(params.preset === 'decal');

  function onDecalClick() {
    if (params.preset !== 'decal') setPreset('decal');
    else setPreset('custom');
  }
</script>

<aside class="rail">
  <button class="rail-btn" disabled={ui.busy} title={t('rail.load')} onclick={onLoadModel}>
    <FolderOpen size={20} />
    <span class="lbl">{t('rail.load')}</span>
  </button>
  <button class="rail-btn" disabled={ui.busy} title={t('rail.loadpbr')} onclick={onLoadPBR}>
    <Palette size={20} />
    <span class="lbl">{t('rail.loadpbr')}</span>
  </button>
  <button
    class="rail-btn"
    class:active={isDecal}
    disabled={ui.busy}
    title={t('decal.title')}
    onclick={onDecalClick}
  >
    <Stamp size={20} />
    <span class="lbl">{t('decal.title')}</span>
  </button>
  <button class="rail-btn" disabled={ui.busy} title={t('rail.save')} onclick={() => ui.saveOpen = true}>
    <Save size={20} />
    <span class="lbl">{t('rail.save')}</span>
  </button>
  <div class="rail-spacer"></div>
  {#if hasPbr}
    <button class="rail-btn danger" disabled={ui.busy} title={t('rail.clearpbr')} onclick={onClearPBR}>
      <Trash2 size={20} />
      <span class="lbl">{t('rail.clearpbr')}</span>
    </button>
  {/if}
  <button class="rail-btn" title={t('rail.settings')} onclick={() => ui.settingsOpen = true}>
    <Settings size={20} />
    <span class="lbl">{t('rail.settings')}</span>
  </button>
</aside>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 6px;
    background: var(--bg-1);
    border-right: 1px solid var(--border);
    flex: 0 0 104px;
    width: 104px;
    min-width: 104px;
    max-width: 104px;
    overflow: hidden;
  }
  .rail-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--fg-1);
    padding: 10px 4px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 10px;
    transition: opacity 0.15s, color 0.15s, border-color 0.15s;
  }
  .rail-btn:hover:not(:disabled) {
    background: var(--bg-2);
    color: var(--fg-0);
    border-color: var(--border);
  }
  .rail-btn.active {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--bg-2);
  }
  .rail-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .rail-btn.danger:hover:not(:disabled) { color: var(--danger); border-color: var(--danger); }
  .rail-spacer { flex: 1; }
</style>