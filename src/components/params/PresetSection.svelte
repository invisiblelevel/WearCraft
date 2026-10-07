<script>
  import { RotateCcw } from '@lucide/svelte';
  import CollapsibleGroup from '../CollapsibleGroup.svelte';
  import RangeField from './RangeField.svelte';
  import ColorField from './ColorField.svelte';
  import ModeSwitch from './ModeSwitch.svelte';
  import MasksBlock from './MasksBlock.svelte';
  import PosPanel from './PosPanel.svelte';
  import { t } from '../../i18n.svelte.js';
  import {
    params, ui, settings, saveSettings,
    scratchParams, resetScratchParams,
    dirtParams, resetDirtParams,
    rustParams, resetRustParams,
    streakParams, resetStreakParams,
    getUserMask,
  } from '../../lib/stores.svelte.js';

  function persistGroups() { saveSettings(); }

  let posOpenScratches = $state(false);
  let posOpenStreaks = $state(false);
  let posOpenDirt = $state(false);
  let posOpenRust = $state(false);

  const lockDirtCountScale = $derived(!!getUserMask('dirt') && ui.currentVariation === 0);
  const lockRustCountScale = $derived(!!getUserMask('rust') && ui.currentVariation === 0);
  const lockStreakCountScale = $derived(
    !streakParams.procedural && !!getUserMask('streaks') && ui.currentVariation === 0
  );
  const lockScratchCountScale = $derived(
    !scratchParams.procedural && !!getUserMask('scratches') && ui.currentVariation === 0
  );
</script>

<!-- ═══════════════════════ SCRATCHES ═══════════════════════ -->
{#if params.preset === 'scratches'}
  <CollapsibleGroup
    title={t('scratch.title')}
    bind:open={settings.groupOpen.presetSettings}
    onopenchange={persistGroups}
  >
    {#snippet headerAction()}
      <button type="button" class="reset-btn-sm" onclick={resetScratchParams}><RotateCcw size={12} /></button>
    {/snippet}

    <ModeSwitch
      left={t('scratch.mode_procedural')}
      right={t('scratch.mode_masks')}
      leftActive={scratchParams.procedural}
      onleft={() => scratchParams.procedural = true}
      onright={() => scratchParams.procedural = false}
    />

    {#if scratchParams.procedural}
      <RangeField label={t('scratch.density')}   bind:value={scratchParams.density}   min={0.1}  max={1.0} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
      <RangeField label={t('scratch.length')}    bind:value={scratchParams.length}    min={0.02} max={0.4} step={0.01} format={(v) => (v * 100).toFixed(0) + '%'} />
      <RangeField label={t('scratch.thickness')} bind:value={scratchParams.thickness} min={0.5}  max={6.0} step={0.1}  format={(v) => v.toFixed(1) + ' px'} />
      <RangeField label={t('scratch.waviness')}  bind:value={scratchParams.waviness}  min={0}    max={1}   step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
      <RangeField label={t('scratch.branches')}  bind:value={scratchParams.branches}  min={0}    max={0.5} step={0.02} format={(v) => (v * 100).toFixed(0) + '%'} />
      <RangeField label={t('scratch.clusters')}  bind:value={scratchParams.clusters}  min={0}    max={1}   step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />

      <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.realistic} /> {t('scratch.realistic')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.rimHighlight} /> {t('scratch.rim_highlight')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.normalEnabled} /> {t('scratch.normal_enabled')}</label>

      {#if scratchParams.normalEnabled}
        <RangeField label={t('scratch.depth')} bind:value={scratchParams.depth} min={0} max={2} step={0.1} format={(v) => (v * 100).toFixed(0) + '%'} />
      {/if}

      <PosPanel
        bind:open={posOpenScratches}
        mode="library"
        bind:posX={scratchParams.posX}
        bind:posY={scratchParams.posY}
        showRandomRotation={false}
      />
    {:else}
      <MasksBlock preset="scratches" />

      <RangeField label={t('rust.count')}     bind:value={scratchParams.count}      min={1} max={8} step={1}    format={(v) => v.toFixed(0)} disabled={lockScratchCountScale} />
      <RangeField label={t('rust.scale')}     bind:value={scratchParams.maskScale}  min={0.3} max={3} step={0.05} disabled={lockScratchCountScale} />
      <RangeField label={t('rust.deform')}    bind:value={scratchParams.deform}     min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
      <RangeField label={t('rust.threshold')} bind:value={scratchParams.threshold}  min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
      <RangeField label={t('rust.sharpness')} bind:value={scratchParams.sharpness}  min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />

      <ColorField label={t('dirt.color')} bind:color={scratchParams.color} bind:pickerOpen={ui.colorPickerOpen} />

      <RangeField label={t('dirt.thickness')} bind:value={scratchParams.maskThickness} min={-1} max={0} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />

      <PosPanel
        bind:open={posOpenScratches}
        mode="library"
        bind:posX={scratchParams.posX}
        bind:posY={scratchParams.posY}
        bind:rotation={scratchParams.rotation}
        bind:randomRotation={scratchParams.randomRotation}
      />

      <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.disableTiling} /> {t('params.disable_tiling')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.maskRimHighlight} /> {t('scratch.rim_highlight')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.maskNormalEnabled} /> {t('scratch.normal_enabled')}</label>
    {/if}
  </CollapsibleGroup>
{/if}

<!-- ═══════════════════════ STREAKS ═══════════════════════ -->
{#if params.preset === 'streaks'}
  <CollapsibleGroup
    title={t('streak.title')}
    bind:open={settings.groupOpen.presetSettings}
    onopenchange={persistGroups}
  >
    {#snippet headerAction()}
      <button type="button" class="reset-btn-sm" onclick={resetStreakParams}><RotateCcw size={12} /></button>
    {/snippet}

    <ModeSwitch
      left={t('streak.mode_procedural')}
      right={t('streak.mode_masks')}
      leftActive={streakParams.procedural}
      onleft={() => streakParams.procedural = true}
      onright={() => streakParams.procedural = false}
    />

    {#if streakParams.procedural}
      <RangeField label={t('streak.count')}     bind:value={streakParams.count}     min={5} max={100} step={1} format={(v) => v.toFixed(0)} />
      <RangeField label={t('streak.size')}      bind:value={streakParams.size}      min={0.001} max={0.03} step={0.0005} format={(v) => (v * 100).toFixed(2) + '%'} />
      <RangeField label={t('streak.stretch_y')} bind:value={streakParams.stretch}   min={1} max={20} step={0.1} format={(v) => v.toFixed(1)} />
      <RangeField label={t('streak.threshold')} bind:value={streakParams.threshold} min={-0.1} max={1} step={0.02} format={(v) => (v * 100).toFixed(0) + '%'} />
      <RangeField label={t('streak.sharpness')} bind:value={streakParams.sharpness} min={-1} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
      <RangeField label={t('streak.thickness')} bind:value={streakParams.thickness} min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />

      <ColorField label={t('streak.color')} bind:color={streakParams.color} bind:pickerOpen={ui.colorPickerOpen} />

      <PosPanel
        bind:open={posOpenStreaks}
        mode="library"
        bind:posX={streakParams.posX}
        bind:posY={streakParams.posY}
        bind:rotation={streakParams.rotation}
        showRandomRotation={false}
      />

      <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.disableTiling} /> {t('params.disable_tiling')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.rimHighlight} /> {t('scratch.rim_highlight')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.normalEnabled} /> {t('scratch.normal_enabled')}</label>
    {:else}
      <MasksBlock preset="streaks" />

      <RangeField label={t('rust.count')}     bind:value={streakParams.count}      min={1} max={8} step={1}    format={(v) => v.toFixed(0)} disabled={lockStreakCountScale} />
      <RangeField label={t('rust.scale')}     bind:value={streakParams.maskScale}  min={0.3} max={3} step={0.05} disabled={lockStreakCountScale} />
      <RangeField label={t('rust.deform')}    bind:value={streakParams.deform}     min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
      <RangeField label={t('rust.threshold')} bind:value={streakParams.threshold}  min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
      <RangeField label={t('rust.sharpness')} bind:value={streakParams.sharpness}  min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />

      <ColorField label={t('streak.color')} bind:color={streakParams.color} bind:pickerOpen={ui.colorPickerOpen} />

      <RangeField label={t('dirt.thickness')} bind:value={streakParams.maskThickness} min={-1} max={0} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />

      <PosPanel
        bind:open={posOpenStreaks}
        mode="library"
        bind:posX={streakParams.posX}
        bind:posY={streakParams.posY}
        bind:rotation={streakParams.rotation}
        bind:randomRotation={streakParams.randomRotation}
      />

      <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.disableTiling} /> {t('params.disable_tiling')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.rimHighlight} /> {t('scratch.rim_highlight')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.normalEnabled} /> {t('scratch.normal_enabled')}</label>
    {/if}
  </CollapsibleGroup>
{/if}

<!-- ═══════════════════════ DIRT ═══════════════════════ -->
{#if params.preset === 'dirt'}
  <CollapsibleGroup
    title={t('dirt.title')}
    bind:open={settings.groupOpen.presetSettings}
    onopenchange={persistGroups}
  >
    {#snippet headerAction()}
      <button type="button" class="reset-btn-sm" onclick={resetDirtParams}><RotateCcw size={12} /></button>
    {/snippet}

    <MasksBlock preset="dirt" />

    <div class="group-head rust-settings-head">
      <h3>{t('dirt.title')}</h3>
    </div>

    <RangeField label={t('rust.count')}     bind:value={dirtParams.count}     min={1} max={8} step={1}    format={(v) => v.toFixed(0)} disabled={lockDirtCountScale} />
    <RangeField label={t('rust.scale')}     bind:value={dirtParams.scale}     min={0.3} max={3} step={0.05} disabled={lockDirtCountScale} />
    <RangeField label={t('rust.deform')}    bind:value={dirtParams.deform}    min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
    <RangeField label={t('rust.threshold')} bind:value={dirtParams.threshold} min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
    <RangeField label={t('rust.sharpness')} bind:value={dirtParams.sharpness} min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />

    <ColorField label={t('dirt.color')} bind:color={dirtParams.color} bind:pickerOpen={ui.colorPickerOpen} />

    <RangeField label={t('dirt.thickness')} bind:value={dirtParams.thickness} min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />

    {#if getUserMask('dirt')}
      <PosPanel
        bind:open={posOpenDirt}
        mode="user"
        userPosKey="dirt"
        onsave={saveSettings}
      />
    {:else}
      <PosPanel
        bind:open={posOpenDirt}
        mode="library"
        bind:posX={dirtParams.posX}
        bind:posY={dirtParams.posY}
        bind:rotation={dirtParams.rotation}
        bind:randomRotation={dirtParams.randomRotation}
      />
    {/if}

    <label class="check normal-check"><input type="checkbox" bind:checked={dirtParams.disableTiling} /> {t('params.disable_tiling')}</label>
    <label class="check normal-check"><input type="checkbox" bind:checked={dirtParams.rimHighlight} /> {t('scratch.rim_highlight')}</label>
    <label class="check normal-check"><input type="checkbox" bind:checked={dirtParams.normalEnabled} /> {t('scratch.normal_enabled')}</label>
  </CollapsibleGroup>
{/if}

<!-- ═══════════════════════ RUST ═══════════════════════ -->
{#if params.preset === 'rust'}
  <CollapsibleGroup
    title={t('rust.title')}
    bind:open={settings.groupOpen.presetSettings}
    onopenchange={persistGroups}
  >
    {#snippet headerAction()}
      <button type="button" class="reset-btn-sm" onclick={resetRustParams}><RotateCcw size={12} /></button>
    {/snippet}

    <MasksBlock preset="rust" />

    <div class="group-head rust-settings-head">
      <h3>{t('rust.title')}</h3>
    </div>

    <RangeField label={t('rust.count')}     bind:value={rustParams.count}     min={1} max={8} step={1}    format={(v) => v.toFixed(0)} disabled={lockRustCountScale} />
    <RangeField label={t('rust.scale')}     bind:value={rustParams.scale}     min={0.3} max={3} step={0.05} disabled={lockRustCountScale} />
    <RangeField label={t('rust.deform')}    bind:value={rustParams.deform}    min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
    <RangeField label={t('rust.threshold')} bind:value={rustParams.threshold} min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
    <RangeField label={t('rust.sharpness')} bind:value={rustParams.sharpness} min={0} max={1} step={0.05} format={(v) => (v * 100).toFixed(0) + '%'} />
    <RangeField label={t('rust.volume')}    bind:value={rustParams.volume}    min={-1} max={1} step={0.05} format={(v) => (v > 0 ? '+' : '') + (v * 100).toFixed(0) + '%'} />

    {#if getUserMask('rust')}
      <PosPanel
        bind:open={posOpenRust}
        mode="user"
        userPosKey="rust"
        onsave={saveSettings}
      />
    {:else}
      <PosPanel
        bind:open={posOpenRust}
        mode="library"
        bind:posX={rustParams.posX}
        bind:posY={rustParams.posY}
        bind:rotation={rustParams.rotation}
        bind:randomRotation={rustParams.randomRotation}
      />
    {/if}

    <label class="check normal-check"><input type="checkbox" bind:checked={rustParams.disableTiling} /> {t('params.disable_tiling')}</label>
    <label class="check normal-check"><input type="checkbox" bind:checked={rustParams.rimHighlight} /> {t('scratch.rim_highlight')}</label>
    <label class="check normal-check"><input type="checkbox" bind:checked={rustParams.normalEnabled} /> {t('scratch.normal_enabled')}</label>
  </CollapsibleGroup>
{/if}

<style>
  :global(.group-head) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  :global(.group-head h3) {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-2);
    margin: 0 0 10px 0;
    font-weight: 600;
  }
</style>