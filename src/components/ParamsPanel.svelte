<script>
  import { Dices, FolderOpen, Eye } from '@lucide/svelte';
  import CollapsibleGroup from './CollapsibleGroup.svelte';
  import TopSection from './params/TopSection.svelte';
  import CustomMaskSection from './params/CustomMaskSection.svelte';
  import DecalSection from './params/DecalSection.svelte';
  import PresetSection from './params/PresetSection.svelte';
  import { t } from '../i18n.svelte.js';
  import {
    params, maskParams, pbr, ui, randomSeed, settings, saveSettings,
    viewer,
  } from '../lib/stores.svelte.js';
  import { onLoadMapFor } from '../lib/actions.svelte.js';

  const MAP_SLOTS = [
    { kind: 'albedo',    label: 'maps.albedo' },
    { kind: 'normal',    label: 'maps.normal' },
    { kind: 'roughness', label: 'maps.roughness' },
    { kind: 'metalness', label: 'maps.metalness' },
    { kind: 'ao',        label: 'maps.ao' },
    { kind: 'height',    label: 'maps.height' },
  ];

  const isDecal = $derived(params.preset === 'decal');

  // Прямое чтение viewer.shape и viewer.loadedModel,
  // чтобы Svelte 5 точно отследил зависимость.
  const geoOk = $derived.by(() => {
    if (viewer.loadedModel) return true;
    const s = viewer.shape;
    return s !== 'cube' && s !== 'cylinder' && s !== 'torus';
  });

  function persistGroups() { saveSettings(); }
</script>

<aside class="params">
  {#if isDecal}
    <DecalSection />
  {/if}

  {#if !isDecal && params.preset === 'custom'}
    <CustomMaskSection />
  {/if}

  {#if !isDecal}
    <TopSection {geoOk} />
  {/if}

  {#if !isDecal && params.preset === 'custom' && !maskParams.enabled}
    <div class="group">
      <div class="custom-warn">
        ⚠️ {t('preset.custom_warn')}
      </div>
    </div>
  {/if}

  <PresetSection />

  <CollapsibleGroup
    title={t('params.title')}
    bind:open={settings.groupOpen.generation}
    onopenchange={persistGroups}
  >
    <div class="field">
      <div class="variations-row">
        <input type="range" min="1" max="50" bind:value={params.variations} />
        <input type="number" min="1" max="50" bind:value={params.variations} class="variations-num" />
      </div>
      <small>{t('params.variations.hint')}</small>
    </div>

    {#if params.preset !== 'rust' && !isDecal}
      <label class="field"><span>{t('params.amount.label')} <em>{params.amount}%</em></span>
        <input type="range" min="0" max="100" bind:value={params.amount} />
        <small>{t('params.amount.hint')}</small></label>
    {/if}

    <label class="field"><span>{t('params.seed.label')}</span>
      <div class="seed-row">
        <input type="number" bind:value={params.seed} />
        <button type="button" onclick={randomSeed}><Dices size={14} /></button>
      </div></label>
  </CollapsibleGroup>

  <CollapsibleGroup
    title={t('maps.title')}
    bind:open={settings.groupOpen.maps}
    onopenchange={persistGroups}
  >
    {#each MAP_SLOTS as slot (slot.kind)}
      <div class="map-row">
        <label class="check" class:loaded={!!pbr.textures[slot.kind]}>
          <input type="checkbox" disabled={!pbr.textures[slot.kind]} bind:checked={pbr.active[slot.kind]} />
          {t(slot.label)}
        </label>
        <button type="button" class="map-load-btn" class:has={!!pbr.textures[slot.kind]} disabled={ui.busy} onclick={() => onLoadMapFor(slot.kind)}>
          <FolderOpen size={13} />
        </button>
      </div>
    {/each}
    {#if pbr.textures.edge}
      <div class="map-row edge-row">
        <label class="check edge-mode" class:active={pbr.showEdgeMode}>
          <input type="checkbox" bind:checked={pbr.showEdgeMode} />
          <Eye size={14} /> Edge preview
        </label>
      </div>
    {/if}
  </CollapsibleGroup>
</aside>

<style>
  .params {
    padding: 12px;
    background: var(--bg-1);
    border-left: 1px solid var(--border);
    overflow-y: auto;
    flex: 0 0 320px;
    width: 320px;
    min-width: 320px;
    max-width: 320px;
    user-select: none;
  }

  :global(.group) {
    margin-bottom: 14px;
  }
  :global(.group h3) {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-2);
    margin: 0 0 10px 0;
    font-weight: 600;
  }
  :global(.custom-warn) {
    font-size: 11px;
    color: var(--fg-2);
    background: rgba(255, 180, 60, 0.1);
    border: 1px solid rgba(255, 180, 60, 0.3);
    padding: 8px 10px;
    border-radius: 4px;
    line-height: 1.4;
  }
  :global(.seed-row) {
    display: flex;
    gap: 4px;
  }
  :global(.seed-row input) {
    flex: 1;
  }
  :global(.seed-row input[type="number"]) {
    width: 100%;
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-0);
    padding: 5px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
  }
  :global(.seed-row button) {
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-0);
    border-radius: 4px;
    padding: 0 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
  }
  :global(.seed-row button:hover) {
    border-color: var(--accent);
  }
  :global(.variations-row) {
    display: grid;
    grid-template-columns: 1fr 56px;
    gap: 8px;
    align-items: center;
  }
  :global(.variations-num) {
    text-align: center;
    padding: 4px 4px !important;
    width: 100%;
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-0);
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
  }

  :global(.map-row) {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 6px;
  }
  :global(.map-row .check) {
    flex: 1;
    margin-bottom: 0;
  }
  :global(.map-row .check.loaded) {
    opacity: 1;
    cursor: pointer;
  }
  :global(.map-row .check:not(.loaded)) {
    opacity: 0.5;
    cursor: not-allowed;
  }
  :global(.map-load-btn) {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-2);
    width: 24px;
    height: 24px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    padding: 0;
  }
  :global(.map-load-btn:hover:not(:disabled)) {
    color: var(--accent);
    border-color: var(--accent);
  }
  :global(.map-load-btn.has) {
    color: var(--accent);
    border-color: var(--accent);
  }
  :global(.map-load-btn:disabled) {
    opacity: 0.3;
    cursor: not-allowed;
  }

  :global(.reset-btn-sm) {
    background: transparent;
    border: none;
    color: var(--fg-2);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
  }
  :global(.reset-btn-sm:hover) {
    color: var(--accent);
    background: var(--bg-2);
  }
  :global(.mask-load-btn) {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
    background: var(--bg-2);
    border: 1px dashed var(--border);
    color: var(--fg-0);
    padding: 10px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
  }
  :global(.mask-load-btn:hover) {
    border-color: var(--accent);
    color: var(--accent);
  }
  :global(.mask-action-btn) {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: flex-start;
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-0);
    padding: 9px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    transition: all 0.15s;
  }
  :global(.mask-action-btn:hover) {
    border-color: var(--accent);
    color: var(--accent);
  }
  :global(.mask-action-btn.library) {
    color: var(--fg-1);
  }
  :global(.mask-action-btn.library:hover) {
    color: var(--accent);
  }
  :global(.library-count) {
    margin-left: auto;
    color: var(--accent);
    font-weight: 600;
    font-size: 11px;
  }
  :global(.library-count:empty::before) {
    content: '0';
  }
  :global(.user-mask-row) {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-2);
    border: 1px solid var(--accent-dim);
    border-radius: 4px;
    padding: 6px 8px;
  }
  :global(.user-mask-name) {
    flex: 1;
    color: var(--accent);
    font-size: 11px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.user-mask-clear) {
    background: transparent;
    border: none;
    color: var(--fg-2);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    border-radius: 3px;
    flex-shrink: 0;
  }
  :global(.user-mask-clear:hover) {
    color: var(--danger);
    background: var(--bg-3);
  }
  :global(.user-mask-hint) {
    font-size: 10px;
    color: var(--fg-2);
    line-height: 1.4;
    padding: 0 2px;
  }
  :global(.hint-inline) {
    margin-left: auto;
    color: var(--fg-2);
    font-size: 10px;
    font-style: italic;
  }
  :global(.sub) {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-2);
    margin: 14px 0 6px 0;
    font-weight: 600;
    opacity: 0.8;
  }
  :global(.sub:first-of-type) {
    margin-top: 6px;
  }
</style>