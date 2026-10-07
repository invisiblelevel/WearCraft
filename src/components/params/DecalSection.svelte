<script>
  import { Image as ImageIcon, Plus, X, RotateCcw } from '@lucide/svelte';
  import CollapsibleGroup from '../CollapsibleGroup.svelte';
  import RangeField from './RangeField.svelte';
  import { t } from '../../i18n.svelte.js';
  import {
    decalParams, resetDecalParams, settings, saveSettings, setPreset,
    pickDecalImage, clearDecalImage, pickDecalHeight, clearDecalHeight,
  } from '../../lib/stores.svelte.js';

  function persistGroups() { saveSettings(); }
  function exitDecal() { setPreset('custom'); }
</script>

<CollapsibleGroup
  title={t('decal.title')}
  bind:open={settings.groupOpen.decal}
  onopenchange={persistGroups}
>
  {#snippet headerAction()}
    <button type="button" class="reset-btn-sm" onclick={resetDecalParams} title={t('decal.reset')}>
      <RotateCcw size={12} />
    </button>
  {/snippet}

  <h4 class="sub">{t('decal.section_image')}</h4>
  {#if !decalParams.enabled}
    <button type="button" class="mask-load-btn" onclick={pickDecalImage}>
      <ImageIcon size={14} />
      {t('decal.load')}
    </button>
  {:else}
    <div class="user-mask-row">
      <span class="user-mask-name" title={decalParams.fileName}>{decalParams.fileName}</span>
      <button type="button" class="user-mask-clear" onclick={clearDecalImage} title="×">
        <X size={12} />
      </button>
    </div>
  {/if}

  <h4 class="sub">{t('decal.section_position')}</h4>
  <RangeField label={t('decal.pos_x')} bind:value={decalParams.posX} min={-1} max={1} step={0.01} />
  <RangeField label={t('decal.pos_y')} bind:value={decalParams.posY} min={-1} max={1} step={0.01} />
  <RangeField label={t('decal.scale')} bind:value={decalParams.scale} min={0.05} max={5} step={0.01} />
  <RangeField label={t('decal.rotation')} bind:value={decalParams.rotation} min={0} max={360} step={1} format={(v) => v.toFixed(0) + '°'} />
  <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.keepAspect} /> {t('decal.keep_aspect')}</label>
  <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.randomPosition} /> {t('decal.random_position')}</label>
  <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.randomRotation} /> {t('decal.random_rotation')}</label>
  <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.tileEdge} /> {t('decal.tile_edge')}</label>

  <h4 class="sub">{t('decal.section_appearance')}</h4>
  <RangeField label={t('decal.opacity')} bind:value={decalParams.opacity} min={0} max={1} step={0.01} format={(v) => (v * 100).toFixed(0) + '%'} />

  <h4 class="sub">{t('decal.section_affect')}</h4>
  <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.affectAlbedo} /> {t('decal.affect_albedo')}</label>
  <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.affectRoughness} /> {t('decal.affect_roughness')}</label>
  <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.affectNormal} /> {t('decal.affect_normal')}</label>

  <h4 class="sub">{t('decal.section_height')}</h4>
  {#if decalParams.heightTexture}
    <div class="user-mask-row">
      <span class="user-mask-name" title={decalParams.heightFileName}>{decalParams.heightFileName}</span>
      <button type="button" class="user-mask-clear" onclick={clearDecalHeight} title="×">
        <X size={12} />
      </button>
    </div>
  {:else}
    <button type="button" class="mask-action-btn" onclick={pickDecalHeight}>
      <Plus size={14} />
      {t('decal.load_height')}
      <span class="hint-inline">{t('decal.height_from_image')}</span>
    </button>
  {/if}
  <RangeField
    label={t('decal.height_intensity')}
    bind:value={decalParams.heightIntensity}
    min={-1} max={1} step={0.05}
    format={(v) => (v > 0 ? '+' : '') + (v * 100).toFixed(0) + '%'}
  />

  <button type="button" class="exit-decal-btn" onclick={exitDecal}>
    {t('decal.exit')}
  </button>
</CollapsibleGroup>

<style>
  :global(.exit-decal-btn) {
    width: 100%;
    margin-top: 16px;
    padding: 8px 10px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-1);
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  :global(.exit-decal-btn:hover) {
    color: var(--accent);
    border-color: var(--accent);
  }
</style>