<script>
  import CollapsibleGroup from '../CollapsibleGroup.svelte';
  import { t } from '../../i18n.svelte.js';
  import { params, setPreset, ui, settings, saveSettings } from '../../lib/stores.svelte.js';

  let { geoOk = false } = $props();

  function persistGroups() { saveSettings(); }
</script>

<div class="group">
  <h3>{t('preset.title')}</h3>
  <select class="preset-select" value={params.preset} onchange={(e) => setPreset(e.currentTarget.value)}>
    <option value="custom">{t('preset.custom')}</option>
    <option value="scratches">{t('preset.scratches')}</option>
    <option value="streaks">{t('preset.streaks')}</option>
    <option value="dirt">{t('preset.dirt')}</option>
    <option value="rust">{t('preset.rust')}</option>
  </select>
</div>

{#if geoOk}
  <CollapsibleGroup
    title={t('geometry_limit.title')}
    bind:open={settings.groupOpen.geometryLimit}
    onopenchange={persistGroups}
  >
    <label class="check normal-check">
      <input type="checkbox" bind:checked={ui.geometryLimitEnabled} onchange={saveSettings} />
      {t('geometry_limit.enable')}
    </label>

    {#if ui.geometryLimitEnabled}
      <label class="field">
        <span>{t('geometry_limit.mode')}</span>
        <select class="preset-select" bind:value={ui.geometryLimitMode} onchange={saveSettings}>
          <option value="sides">{t('geometry_limit.mode_sides')}</option>
          <option value="top">{t('geometry_limit.mode_top')}</option>
          <option value="bottom">{t('geometry_limit.mode_bottom')}</option>
          <option value="top_bottom">{t('geometry_limit.mode_top_bottom')}</option>
        </select>
      </label>

      <label class="field">
        <span>{t('geometry_limit.softness')} <em>{ui.geometryLimitSoftness.toFixed(2)}</em></span>
        <input type="range" min="0" max="1" step="0.05" bind:value={ui.geometryLimitSoftness} onchange={saveSettings} />
      </label>

      <label class="check normal-check">
        <input type="checkbox" bind:checked={ui.geometryLimitInvert} onchange={saveSettings} />
        {t('geometry_limit.invert')}
      </label>
    {/if}
  </CollapsibleGroup>
{/if}

<style>
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
  :global(.preset-select) {
    width: 100%;
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-0);
    padding: 6px 8px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  :global(.preset-select:hover) {
    border-color: var(--accent);
  }
  :global(.preset-select:focus) {
    outline: none;
    border-color: var(--accent);
  }
  :global(.preset-select option) {
    background: var(--bg-2);
    color: var(--fg-0);
  }
</style>