<script>
  import { FolderOpen, RotateCcw } from '@lucide/svelte';
  import CollapsibleGroup from '../CollapsibleGroup.svelte';
  import RangeField from './RangeField.svelte';
  import ColorField from './ColorField.svelte';
  import { t } from '../../i18n.svelte.js';
  import { maskParams, ui, settings, saveSettings } from '../../lib/stores.svelte.js';
  import { onLoadMask, onClearMask } from '../../lib/actions.svelte.js';

  function persistGroups() { saveSettings(); }
</script>

<CollapsibleGroup
  title={t('mask.title')}
  bind:open={settings.groupOpen.mask}
  onopenchange={persistGroups}
>
  {#snippet headerAction()}
    {#if maskParams.enabled}
      <button type="button" class="reset-btn-sm" onclick={onClearMask} title="Очистить">
        <RotateCcw size={12} />
      </button>
    {/if}
  {/snippet}

  {#if !maskParams.enabled}
    <button type="button" class="mask-load-btn" onclick={onLoadMask}>
      <FolderOpen size={14} />
      {t('mask.load')}
    </button>
  {:else}
    <div class="mask-info">
      <span class="mask-name" title={maskParams.fileName}>{maskParams.fileName}</span>
      <span class="mask-kind">{maskParams.kind === 'color' ? t('mask.kind_color') : t('mask.kind_mono')}</span>
    </div>

    <RangeField label={t('mask.pos_x')} bind:value={maskParams.posX} min={-1} max={1} step={0.01} />
    <RangeField label={t('mask.pos_y')} bind:value={maskParams.posY} min={-1} max={1} step={0.01} />
    <RangeField label={t('mask.scale')} bind:value={maskParams.scale} min={0.1} max={5} step={0.05} />
    <RangeField label={t('mask.rotation')} bind:value={maskParams.rotation} min={0} max={360} step={1} format={(v) => v.toFixed(0) + '°'} />
    <RangeField label={t('mask.opacity')} bind:value={maskParams.opacity} min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />

    {#if maskParams.kind === 'mono'}
      <ColorField label={t('mask.color')} bind:color={maskParams.color} bind:pickerOpen={ui.maskColorPickerOpen} />
    {/if}

    <label class="check normal-check"><input type="checkbox" bind:checked={maskParams.affectAlbedo} /> {t('mask.affect_albedo')}</label>
    <label class="check normal-check"><input type="checkbox" bind:checked={maskParams.affectRoughness} /> {t('mask.affect_roughness')}</label>
    <label class="check normal-check"><input type="checkbox" bind:checked={maskParams.affectNormal} /> {t('mask.affect_normal')}</label>
  {/if}
</CollapsibleGroup>

<style>
  :global(.mask-info) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
    padding: 6px 8px;
    background: var(--bg-2);
    border-radius: 4px;
    font-size: 11px;
  }
  :global(.mask-name) {
    color: var(--fg-0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  :global(.mask-kind) {
    color: var(--accent);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }
</style>