<script>
  import { Dices, FolderOpen, Eye, RotateCcw, Plus, X, Library, ChevronDown, Image as ImageIcon, Stamp } from '@lucide/svelte';
  import ColorPicker from './ColorPicker.svelte';
  import CollapsibleGroup from './CollapsibleGroup.svelte';
  import { t } from '../i18n.svelte.js';
  import {
    params, scratchParams, resetScratchParams,
    dirtParams, resetDirtParams,
    rustParams, resetRustParams,
    streakParams, resetStreakParams,
    maskParams,
    decalParams, resetDecalParams,
    pickDecalImage, clearDecalImage,
    pickDecalHeight, clearDecalHeight,
    pbr, ui, randomSeed, setPreset,
    settings,
    pickUserMask, clearUserMask, getUserMask, getUserMaskBasename,
    getFolderMaskNames, markMasksInfoShown,
    resetUserMaskPos, saveSettings,
    isGeoLimitSupported,
  } from '../lib/stores.svelte.js';
  import { onLoadMapFor, onLoadMask, onClearMask } from '../lib/actions.svelte.js';

  const MAP_SLOTS = [
    { kind: 'albedo',    label: 'maps.albedo' },
    { kind: 'normal',    label: 'maps.normal' },
    { kind: 'roughness', label: 'maps.roughness' },
    { kind: 'metalness', label: 'maps.metalness' },
    { kind: 'ao',        label: 'maps.ao' },
    { kind: 'height',    label: 'maps.height' },
  ];

  let posOpen = $state({ rust: false, dirt: false, streaks: false, scratches: false, streaksProc: false, scratchesProc: false });
  let libPosOpen = $state({ rust: false, dirt: false, streaks: false });
  const lockDirtCountScale = $derived(!!getUserMask('dirt') && ui.currentVariation === 0);
  const lockRustCountScale = $derived(!!getUserMask('rust') && ui.currentVariation === 0);
  const lockStreakCountScale = $derived(
    !streakParams.procedural && !!getUserMask('streaks') && ui.currentVariation === 0
  );
  const lockScratchCountScale = $derived(
    !scratchParams.procedural && !!getUserMask('scratches') && ui.currentVariation === 0
  );

  const isDecal = $derived(params.preset === 'decal');
  const geoOk = $derived(isGeoLimitSupported());

  function persistGroups() {
    saveSettings();
  }

  function openDirtPicker() { ui.colorPickerOpen = !ui.colorPickerOpen; }
  function openMaskPicker() { ui.maskColorPickerOpen = !ui.maskColorPickerOpen; }
  function applyDirtColor() { ui.colorPickerOpen = false; }
  function applyMaskColor() { ui.maskColorPickerOpen = false; }
  function rgbToCss([r, g, b]) { return `rgb(${r}, ${g}, ${b})`; }
  function rgbToHex([r, g, b]) {
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function openMasksLibrary(preset) {
    if (!settings.masksInfoShown) {
      ui.pendingMasksLibrary = preset;
      ui.masksInfoOpen = true;
    } else {
      ui.masksLibraryOpen = preset;
    }
  }

  function setStreakMode(procedural) { streakParams.procedural = procedural; }
  function exitDecal() { setPreset('custom'); }
</script>

<aside class="params">

  {#if isDecal}
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
      <label class="field"><span>{t('decal.pos_x')} <em>{decalParams.posX.toFixed(2)}</em></span>
        <input type="range" min="-1" max="1" step="0.01" bind:value={decalParams.posX} /></label>
      <label class="field"><span>{t('decal.pos_y')} <em>{decalParams.posY.toFixed(2)}</em></span>
        <input type="range" min="-1" max="1" step="0.01" bind:value={decalParams.posY} /></label>
      <label class="field"><span>{t('decal.scale')} <em>{decalParams.scale.toFixed(2)}</em></span>
        <input type="range" min="0.05" max="5" step="0.01" bind:value={decalParams.scale} /></label>
      <label class="field"><span>{t('decal.rotation')} <em>{decalParams.rotation.toFixed(0)}°</em></span>
        <input type="range" min="0" max="360" step="1" bind:value={decalParams.rotation} /></label>
      <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.keepAspect} /> {t('decal.keep_aspect')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.randomPosition} /> {t('decal.random_position')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.randomRotation} /> {t('decal.random_rotation')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={decalParams.tileEdge} /> {t('decal.tile_edge')}</label>

      <h4 class="sub">{t('decal.section_appearance')}</h4>
      <label class="field"><span>{t('decal.opacity')} <em>{(decalParams.opacity * 100).toFixed(0)}%</em></span>
        <input type="range" min="0" max="1" step="0.01" bind:value={decalParams.opacity} /></label>

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
      <label class="field"><span>{t('decal.height_intensity')} <em>{decalParams.heightIntensity > 0 ? '+' : ''}{(decalParams.heightIntensity * 100).toFixed(0)}%</em></span>
        <input type="range" min="-1" max="1" step="0.05" bind:value={decalParams.heightIntensity} /></label>

      <button type="button" class="exit-decal-btn" onclick={exitDecal}>
        {t('decal.exit')}
      </button>
    </CollapsibleGroup>
  {/if}

  {#if !isDecal && params.preset === 'custom'}
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

        <label class="field"><span>{t('mask.pos_x')} <em>{maskParams.posX.toFixed(2)}</em></span>
          <input type="range" min="-1" max="1" step="0.01" bind:value={maskParams.posX} /></label>
        <label class="field"><span>{t('mask.pos_y')} <em>{maskParams.posY.toFixed(2)}</em></span>
          <input type="range" min="-1" max="1" step="0.01" bind:value={maskParams.posY} /></label>
        <label class="field"><span>{t('mask.scale')} <em>{maskParams.scale.toFixed(2)}</em></span>
          <input type="range" min="0.1" max="5" step="0.05" bind:value={maskParams.scale} /></label>
        <label class="field"><span>{t('mask.rotation')} <em>{maskParams.rotation.toFixed(0)}°</em></span>
          <input type="range" min="0" max="360" step="1" bind:value={maskParams.rotation} /></label>
        <label class="field"><span>{t('mask.opacity')} <em>{(maskParams.opacity * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={maskParams.opacity} /></label>

        {#if maskParams.kind === 'mono'}
          <div class="field">
            <span>{t('mask.color')}</span>
            <button type="button" class="color-btn" onclick={openMaskPicker}>
              <span class="color-swatch" style="background: {rgbToCss(maskParams.color)}"></span>
              <span class="color-hex">{rgbToHex(maskParams.color)}</span>
            </button>
            {#if ui.maskColorPickerOpen}
              <div class="color-popover">
                <ColorPicker
                  rgb={{ r: maskParams.color[0], g: maskParams.color[1], b: maskParams.color[2] }}
                  onchange={(c) => { maskParams.color = [c.r, c.g, c.b]; }}
                  onapply={applyMaskColor}
                  oncancel={applyMaskColor}
                />
              </div>
            {/if}
          </div>
        {/if}

        <label class="check normal-check"><input type="checkbox" bind:checked={maskParams.affectAlbedo} /> {t('mask.affect_albedo')}</label>
        <label class="check normal-check"><input type="checkbox" bind:checked={maskParams.affectRoughness} /> {t('mask.affect_roughness')}</label>
        <label class="check normal-check"><input type="checkbox" bind:checked={maskParams.affectNormal} /> {t('mask.affect_normal')}</label>
      {/if}
    </CollapsibleGroup>
  {/if}

  {#if !isDecal}
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
  {/if}

  {#if !isDecal && params.preset === 'custom' && !maskParams.enabled}
    <div class="group">
      <div class="custom-warn">
        ⚠️ {t('preset.custom_warn')}
      </div>
    </div>
  {/if}

  {#if params.preset === 'scratches'}
    <CollapsibleGroup
      title={t('scratch.title')}
      bind:open={settings.groupOpen.presetSettings}
      onopenchange={persistGroups}
    >
      {#snippet headerAction()}
        <button type="button" class="reset-btn-sm" onclick={resetScratchParams}><RotateCcw size={12} /></button>
      {/snippet}

      <div class="mode-switch">
        <button type="button" class:active={scratchParams.procedural} onclick={() => scratchParams.procedural = true}>
          {t('scratch.mode_procedural')}
        </button>
        <button type="button" class:active={!scratchParams.procedural} onclick={() => scratchParams.procedural = false}>
          {t('scratch.mode_masks')}
        </button>
      </div>

      {#if scratchParams.procedural}
        <label class="field"><span>{t('scratch.density')} <em>{(scratchParams.density * 100).toFixed(0)}%</em></span>
          <input type="range" min="0.1" max="1.0" step="0.05" bind:value={scratchParams.density} /></label>
        <label class="field"><span>{t('scratch.length')} <em>{(scratchParams.length * 100).toFixed(0)}%</em></span>
          <input type="range" min="0.02" max="0.4" step="0.01" bind:value={scratchParams.length} /></label>
        <label class="field"><span>{t('scratch.thickness')} <em>{scratchParams.thickness.toFixed(1)} px</em></span>
          <input type="range" min="0.5" max="6.0" step="0.1" bind:value={scratchParams.thickness} /></label>
        <label class="field"><span>{t('scratch.waviness')} <em>{(scratchParams.waviness * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={scratchParams.waviness} /></label>
        <label class="field"><span>{t('scratch.branches')} <em>{(scratchParams.branches * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="0.5" step="0.02" bind:value={scratchParams.branches} /></label>
        <label class="field"><span>{t('scratch.clusters')} <em>{(scratchParams.clusters * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={scratchParams.clusters} /></label>
        <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.realistic} /> {t('scratch.realistic')}</label>
        <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.rimHighlight} /> {t('scratch.rim_highlight')}</label>
        <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.normalEnabled} /> {t('scratch.normal_enabled')}</label>
        {#if scratchParams.normalEnabled}
          <label class="field"><span>{t('scratch.depth')} <em>{(scratchParams.depth * 100).toFixed(0)}%</em></span>
            <input type="range" min="0" max="2" step="0.1" bind:value={scratchParams.depth} /></label>
        {/if}

        <button type="button" class="pos-toggle" onclick={() => posOpen.scratches = !posOpen.scratches}>
          <span>{t('mask.position')}</span>
          <span class="pos-chev {posOpen.scratches ? 'open' : ''}">
            <ChevronDown size={12} />
          </span>
        </button>

        {#if posOpen.scratches}
          <div class="pos-panel">
            <label class="field"><span>{t('spots.pos_x')} <em>{scratchParams.posX.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={scratchParams.posX} /></label>
            <label class="field"><span>{t('spots.pos_y')} <em>{scratchParams.posY.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={scratchParams.posY} /></label>
          </div>
        {/if}
      {:else}
        <div class="masks-block">
          {#if getUserMask('scratches')}
            <div class="user-mask-row">
              <span class="user-mask-name" title={getUserMask('scratches')}>{getUserMaskBasename('scratches')}</span>
              <button type="button" class="user-mask-clear" onclick={() => clearUserMask('scratches')} title="Очистить">
                <X size={12} />
              </button>
            </div>
            <div class="user-mask-hint">{t('mask.user_only_hint')}</div>
          {:else}
            <button type="button" class="mask-action-btn" onclick={() => pickUserMask('scratches')}>
              <Plus size={14} />
              {t('mask.add_user')}
            </button>
            <button type="button" class="mask-action-btn library" onclick={() => openMasksLibrary('scratches')}>
              <Library size={14} />
              {t('mask.library')}
              <span class="library-count">({getFolderMaskNames('scratches').length})</span>
            </button>
          {/if}
        </div>

        <label class="field" class:disabled={lockScratchCountScale}><span>{t('rust.count')} <em>{scratchParams.count.toFixed(0)}</em></span>
          <input type="range" min="1" max="8" step="1" bind:value={scratchParams.count} disabled={lockScratchCountScale} /></label>

        <label class="field" class:disabled={lockScratchCountScale}><span>{t('rust.scale')} <em>{scratchParams.maskScale.toFixed(2)}</em></span>
          <input type="range" min="0.3" max="3" step="0.05" bind:value={scratchParams.maskScale} disabled={lockScratchCountScale} /></label>

        <label class="field"><span>{t('rust.deform')} <em>{(scratchParams.deform * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={scratchParams.deform} /></label>

        <label class="field"><span>{t('rust.threshold')} <em>{(scratchParams.threshold * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={scratchParams.threshold} /></label>

        <label class="field"><span>{t('rust.sharpness')} <em>{(scratchParams.sharpness * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={scratchParams.sharpness} /></label>

        <div class="field">
          <span>{t('dirt.color')}</span>
          <button type="button" class="color-btn" onclick={openDirtPicker}>
            <span class="color-swatch" style="background: {rgbToCss(scratchParams.color)}"></span>
            <span class="color-hex">{rgbToHex(scratchParams.color)}</span>
          </button>
          {#if ui.colorPickerOpen}
            <div class="color-popover">
              <ColorPicker
                rgb={{ r: scratchParams.color[0], g: scratchParams.color[1], b: scratchParams.color[2] }}
                onchange={(c) => { scratchParams.color = [c.r, c.g, c.b]; }}
                onapply={applyDirtColor}
                oncancel={applyDirtColor}
              />
            </div>
          {/if}
        </div>

        <label class="field"><span>{t('dirt.thickness')} <em>{(scratchParams.maskThickness * 100).toFixed(0)}%</em></span>
          <input type="range" min="-1" max="0" step="0.05" bind:value={scratchParams.maskThickness} /></label>

        <button type="button" class="pos-toggle" onclick={() => posOpen.scratches = !posOpen.scratches}>
          <span>{t('mask.position')}</span>
          <span class="pos-chev {posOpen.scratches ? 'open' : ''}">
            <ChevronDown size={12} />
          </span>
        </button>

        {#if posOpen.scratches}
          <div class="pos-panel">
            <label class="field"><span>{t('spots.pos_x')} <em>{scratchParams.posX.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={scratchParams.posX} /></label>
            <label class="field"><span>{t('spots.pos_y')} <em>{scratchParams.posY.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={scratchParams.posY} /></label>
            <label class="field"><span>{t('spots.rotation')} <em>{scratchParams.rotation.toFixed(0)}°</em></span>
              <input type="range" min="0" max="360" step="1" bind:value={scratchParams.rotation} /></label>
            <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.randomRotation} /> {t('spots.random_rotation')}</label>
          </div>
        {/if}

        <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.disableTiling} /> {t('params.disable_tiling')}</label>
        <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.maskRimHighlight} /> {t('scratch.rim_highlight')}</label>
        <label class="check normal-check"><input type="checkbox" bind:checked={scratchParams.maskNormalEnabled} /> {t('scratch.normal_enabled')}</label>
      {/if}
    </CollapsibleGroup>
  {/if}

  {#if params.preset === 'streaks'}
    <CollapsibleGroup
      title={t('streak.title')}
      bind:open={settings.groupOpen.presetSettings}
      onopenchange={persistGroups}
    >
      {#snippet headerAction()}
        <button type="button" class="reset-btn-sm" onclick={resetStreakParams}><RotateCcw size={12} /></button>
      {/snippet}

      <div class="mode-switch">
        <button type="button" class:active={streakParams.procedural} onclick={() => setStreakMode(true)}>
          {t('streak.mode_procedural')}
        </button>
        <button type="button" class:active={!streakParams.procedural} onclick={() => setStreakMode(false)}>
          {t('streak.mode_masks')}
        </button>
      </div>

      {#if streakParams.procedural}
        <label class="field"><span>{t('streak.count')} <em>{streakParams.count.toFixed(0)}</em></span>
          <input type="range" min="5" max="100" step="1" bind:value={streakParams.count} /></label>

        <label class="field"><span>{t('streak.size')} <em>{(streakParams.size * 100).toFixed(2)}%</em></span>
          <input type="range" min="0.001" max="0.03" step="0.0005" bind:value={streakParams.size} /></label>

        <label class="field"><span>{t('streak.stretch_y')} <em>{streakParams.stretch.toFixed(1)}</em></span>
          <input type="range" min="1" max="20" step="0.1" bind:value={streakParams.stretch} /></label>

        <label class="field"><span>{t('streak.threshold')} <em>{(streakParams.threshold * 100).toFixed(0)}%</em></span>
          <input type="range" min="-0.1" max="1" step="0.02" bind:value={streakParams.threshold} /></label>

        <label class="field"><span>{t('streak.sharpness')} <em>{(streakParams.sharpness * 100).toFixed(0)}%</em></span>
          <input type="range" min="-1" max="1" step="0.05" bind:value={streakParams.sharpness} /></label>

        <label class="field"><span>{t('streak.thickness')} <em>{(streakParams.thickness * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={streakParams.thickness} /></label>

        <div class="field">
          <span>{t('streak.color')}</span>
          <button type="button" class="color-btn" onclick={openDirtPicker}>
            <span class="color-swatch" style="background: {rgbToCss(streakParams.color)}"></span>
            <span class="color-hex">{rgbToHex(streakParams.color)}</span>
          </button>
          {#if ui.colorPickerOpen}
            <div class="color-popover">
              <ColorPicker
                rgb={{ r: streakParams.color[0], g: streakParams.color[1], b: streakParams.color[2] }}
                onchange={(c) => { streakParams.color = [c.r, c.g, c.b]; }}
                onapply={applyDirtColor}
                oncancel={applyDirtColor}
              />
            </div>
          {/if}
        </div>

        <button type="button" class="pos-toggle" onclick={() => posOpen.streaks = !posOpen.streaks}>
          <span>{t('mask.position')}</span>
          <span class="pos-chev {posOpen.streaks ? 'open' : ''}">
            <ChevronDown size={12} />
          </span>
        </button>

        {#if posOpen.streaks}
          <div class="pos-panel">
            <label class="field"><span>{t('spots.pos_x')} <em>{streakParams.posX.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={streakParams.posX} /></label>
            <label class="field"><span>{t('spots.pos_y')} <em>{streakParams.posY.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={streakParams.posY} /></label>
            <label class="field"><span>{t('spots.rotation')} <em>{streakParams.rotation.toFixed(0)}°</em></span>
              <input type="range" min="0" max="360" step="1" bind:value={streakParams.rotation} /></label>
          </div>
        {/if}

        <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.disableTiling} /> {t('params.disable_tiling')}</label>
        <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.rimHighlight} /> {t('scratch.rim_highlight')}</label>
        <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.normalEnabled} /> {t('scratch.normal_enabled')}</label>
      {:else}
        <div class="masks-block">
          {#if getUserMask('streaks')}
            <div class="user-mask-row">
              <span class="user-mask-name" title={getUserMask('streaks')}>{getUserMaskBasename('streaks')}</span>
              <button type="button" class="user-mask-clear" onclick={() => clearUserMask('streaks')} title="Очистить">
                <X size={12} />
              </button>
            </div>
            <div class="user-mask-hint">{t('mask.user_only_hint')}</div>
          {:else}
            <button type="button" class="mask-action-btn" onclick={() => pickUserMask('streaks')}>
              <Plus size={14} />
              {t('mask.add_user')}
            </button>
            <button type="button" class="mask-action-btn library" onclick={() => openMasksLibrary('streaks')}>
              <Library size={14} />
              {t('mask.library')}
              <span class="library-count">({getFolderMaskNames('streaks').length})</span>
            </button>
          {/if}
        </div>

        <label class="field" class:disabled={lockStreakCountScale}><span>{t('rust.count')} <em>{streakParams.count.toFixed(0)}</em></span>
          <input type="range" min="1" max="8" step="1" bind:value={streakParams.count} disabled={lockStreakCountScale} /></label>

        <label class="field" class:disabled={lockStreakCountScale}><span>{t('rust.scale')} <em>{streakParams.maskScale.toFixed(2)}</em></span>
          <input type="range" min="0.3" max="3" step="0.05" bind:value={streakParams.maskScale} disabled={lockStreakCountScale} /></label>

        <label class="field"><span>{t('rust.deform')} <em>{(streakParams.deform * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={streakParams.deform} /></label>

        <label class="field"><span>{t('rust.threshold')} <em>{(streakParams.threshold * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={streakParams.threshold} /></label>

        <label class="field"><span>{t('rust.sharpness')} <em>{(streakParams.sharpness * 100).toFixed(0)}%</em></span>
          <input type="range" min="0" max="1" step="0.05" bind:value={streakParams.sharpness} /></label>

        <div class="field">
          <span>{t('streak.color')}</span>
          <button type="button" class="color-btn" onclick={openDirtPicker}>
            <span class="color-swatch" style="background: {rgbToCss(streakParams.color)}"></span>
            <span class="color-hex">{rgbToHex(streakParams.color)}</span>
          </button>
          {#if ui.colorPickerOpen}
            <div class="color-popover">
              <ColorPicker
                rgb={{ r: streakParams.color[0], g: streakParams.color[1], b: streakParams.color[2] }}
                onchange={(c) => { streakParams.color = [c.r, c.g, c.b]; }}
                onapply={applyDirtColor}
                oncancel={applyDirtColor}
              />
            </div>
          {/if}
        </div>

        <label class="field"><span>{t('dirt.thickness')} <em>{(streakParams.maskThickness * 100).toFixed(0)}%</em></span>
          <input type="range" min="-1" max="0" step="0.05" bind:value={streakParams.maskThickness} /></label>

        <button type="button" class="pos-toggle" onclick={() => posOpen.streaks = !posOpen.streaks}>
          <span>{t('mask.position')}</span>
          <span class="pos-chev {posOpen.streaks ? 'open' : ''}">
            <ChevronDown size={12} />
          </span>
        </button>

        {#if posOpen.streaks}
          <div class="pos-panel">
            <label class="field"><span>{t('spots.pos_x')} <em>{streakParams.posX.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={streakParams.posX} /></label>
            <label class="field"><span>{t('spots.pos_y')} <em>{streakParams.posY.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={streakParams.posY} /></label>
            <label class="field"><span>{t('spots.rotation')} <em>{streakParams.rotation.toFixed(0)}°</em></span>
              <input type="range" min="0" max="360" step="1" bind:value={streakParams.rotation} /></label>
            <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.randomRotation} /> {t('spots.random_rotation')}</label>
          </div>
        {/if}

        <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.disableTiling} /> {t('params.disable_tiling')}</label>
        <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.rimHighlight} /> {t('scratch.rim_highlight')}</label>
        <label class="check normal-check"><input type="checkbox" bind:checked={streakParams.normalEnabled} /> {t('scratch.normal_enabled')}</label>
      {/if}
    </CollapsibleGroup>
  {/if}

  {#if params.preset === 'dirt'}
    <CollapsibleGroup
      title={t('dirt.title')}
      bind:open={settings.groupOpen.presetSettings}
      onopenchange={persistGroups}
    >
      {#snippet headerAction()}
        <button type="button" class="reset-btn-sm" onclick={resetDirtParams}><RotateCcw size={12} /></button>
      {/snippet}

      <div class="masks-block">
        {#if getUserMask('dirt')}
          <div class="user-mask-row">
            <span class="user-mask-name" title={getUserMask('dirt')}>{getUserMaskBasename('dirt')}</span>
            <button type="button" class="user-mask-clear" onclick={() => clearUserMask('dirt')} title="Очистить">
              <X size={12} />
            </button>
          </div>
          <div class="user-mask-hint">{t('mask.user_only_hint')}</div>
        {:else}
          <button type="button" class="mask-action-btn" onclick={() => pickUserMask('dirt')}>
            <Plus size={14} />
            {t('mask.add_user')}
          </button>
          <button type="button" class="mask-action-btn library" onclick={() => openMasksLibrary('dirt')}>
            <Library size={14} />
            {t('mask.library')}
            <span class="library-count">({getFolderMaskNames('dirt').length})</span>
          </button>
        {/if}
      </div>

      <div class="group-head rust-settings-head">
        <h3>{t('dirt.title')}</h3>
      </div>

      <label class="field" class:disabled={lockDirtCountScale}><span>{t('rust.count')} <em>{dirtParams.count.toFixed(0)}</em></span>
        <input type="range" min="1" max="8" step="1" bind:value={dirtParams.count} disabled={lockDirtCountScale} /></label>

      <label class="field" class:disabled={lockDirtCountScale}><span>{t('rust.scale')} <em>{dirtParams.scale.toFixed(2)}</em></span>
        <input type="range" min="0.3" max="3" step="0.05" bind:value={dirtParams.scale} disabled={lockDirtCountScale} /></label>

      <label class="field"><span>{t('rust.deform')} <em>{(dirtParams.deform * 100).toFixed(0)}%</em></span>
        <input type="range" min="0" max="1" step="0.05" bind:value={dirtParams.deform} /></label>

      <label class="field"><span>{t('rust.threshold')} <em>{(dirtParams.threshold * 100).toFixed(0)}%</em></span>
        <input type="range" min="0" max="1" step="0.05" bind:value={dirtParams.threshold} /></label>

      <label class="field"><span>{t('rust.sharpness')} <em>{(dirtParams.sharpness * 100).toFixed(0)}%</em></span>
        <input type="range" min="0" max="1" step="0.05" bind:value={dirtParams.sharpness} /></label>

      <div class="field">
        <span>{t('dirt.color')}</span>
        <button type="button" class="color-btn" onclick={openDirtPicker}>
          <span class="color-swatch" style="background: {rgbToCss(dirtParams.color)}"></span>
          <span class="color-hex">{rgbToHex(dirtParams.color)}</span>
        </button>
        {#if ui.colorPickerOpen}
          <div class="color-popover">
            <ColorPicker
              rgb={{ r: dirtParams.color[0], g: dirtParams.color[1], b: dirtParams.color[2] }}
              onchange={(c) => { dirtParams.color = [c.r, c.g, c.b]; }}
              onapply={applyDirtColor}
              oncancel={applyDirtColor}
            />
          </div>
        {/if}
      </div>

      <label class="field"><span>{t('dirt.thickness')} <em>{(dirtParams.thickness * 100).toFixed(0)}%</em></span>
        <input type="range" min="0" max="1" step="0.05" bind:value={dirtParams.thickness} /></label>

      {#if getUserMask('dirt')}
        <button type="button" class="pos-toggle" onclick={() => posOpen.dirt = !posOpen.dirt}>
          <span>{t('mask.position')}</span>
          <span class="pos-chev {posOpen.dirt ? 'open' : ''}">
            <ChevronDown size={12} />
          </span>
        </button>

        {#if posOpen.dirt}
          <div class="pos-panel">
            <label class="field"><span>{t('mask.pos_x')} <em>{settings.userMaskDirtPos.offsetX.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={settings.userMaskDirtPos.offsetX} onchange={saveSettings} /></label>
            <label class="field"><span>{t('mask.pos_y')} <em>{settings.userMaskDirtPos.offsetY.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={settings.userMaskDirtPos.offsetY} onchange={saveSettings} /></label>
            <label class="field"><span>{t('mask.rotation')} <em>{settings.userMaskDirtPos.rotation.toFixed(0)}°</em></span>
              <input type="range" min="0" max="360" step="1" bind:value={settings.userMaskDirtPos.rotation} onchange={saveSettings} /></label>
            <label class="field"><span>{t('mask.scale')} <em>{settings.userMaskDirtPos.scale.toFixed(2)}</em></span>
              <input type="range" min="0.05" max="5.0" step="0.05" bind:value={settings.userMaskDirtPos.scale} onchange={saveSettings} /></label>
            <button type="button" class="pos-reset" onclick={() => resetUserMaskPos('dirt')}>
              <RotateCcw size={11} /> {t('mask.pos_reset')}
            </button>
          </div>
        {/if}
      {:else}
        <button type="button" class="pos-toggle" onclick={() => libPosOpen.dirt = !libPosOpen.dirt}>
          <span>{t('mask.position')}</span>
          <span class="pos-chev {libPosOpen.dirt ? 'open' : ''}">
            <ChevronDown size={12} />
          </span>
        </button>

        {#if libPosOpen.dirt}
          <div class="pos-panel">
            <label class="field"><span>{t('spots.pos_x')} <em>{dirtParams.posX.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={dirtParams.posX} /></label>
            <label class="field"><span>{t('spots.pos_y')} <em>{dirtParams.posY.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={dirtParams.posY} /></label>
            <label class="field"><span>{t('spots.rotation')} <em>{dirtParams.rotation.toFixed(0)}°</em></span>
              <input type="range" min="0" max="360" step="1" bind:value={dirtParams.rotation} /></label>
            <label class="check normal-check"><input type="checkbox" bind:checked={dirtParams.randomRotation} /> {t('spots.random_rotation')}</label>
          </div>
        {/if}
      {/if}

      <label class="check normal-check"><input type="checkbox" bind:checked={dirtParams.disableTiling} /> {t('params.disable_tiling')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={dirtParams.rimHighlight} /> {t('scratch.rim_highlight')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={dirtParams.normalEnabled} /> {t('scratch.normal_enabled')}</label>
    </CollapsibleGroup>
  {/if}

  {#if params.preset === 'rust'}
    <CollapsibleGroup
      title={t('rust.title')}
      bind:open={settings.groupOpen.presetSettings}
      onopenchange={persistGroups}
    >
      {#snippet headerAction()}
        <button type="button" class="reset-btn-sm" onclick={resetRustParams}><RotateCcw size={12} /></button>
      {/snippet}

      <div class="masks-block">
        {#if getUserMask('rust')}
          <div class="user-mask-row">
            <span class="user-mask-name" title={getUserMask('rust')}>{getUserMaskBasename('rust')}</span>
            <button type="button" class="user-mask-clear" onclick={() => clearUserMask('rust')} title="Очистить">
              <X size={12} />
            </button>
          </div>
          <div class="user-mask-hint">{t('mask.user_only_hint')}</div>
        {:else}
          <button type="button" class="mask-action-btn" onclick={() => pickUserMask('rust')}>
            <Plus size={14} />
            {t('mask.add_user')}
          </button>
          <button type="button" class="mask-action-btn library" onclick={() => openMasksLibrary('rust')}>
            <Library size={14} />
            {t('mask.library')}
            <span class="library-count">({getFolderMaskNames('rust').length})</span>
          </button>
        {/if}
      </div>

      <div class="group-head rust-settings-head">
        <h3>{t('rust.title')}</h3>
      </div>

      <label class="field" class:disabled={lockRustCountScale}><span>{t('rust.count')} <em>{rustParams.count.toFixed(0)}</em></span>
        <input type="range" min="1" max="8" step="1" bind:value={rustParams.count} disabled={lockRustCountScale} /></label>

      <label class="field" class:disabled={lockRustCountScale}><span>{t('rust.scale')} <em>{rustParams.scale.toFixed(2)}</em></span>
        <input type="range" min="0.3" max="3" step="0.05" bind:value={rustParams.scale} disabled={lockRustCountScale} /></label>

      <label class="field"><span>{t('rust.deform')} <em>{(rustParams.deform * 100).toFixed(0)}%</em></span>
        <input type="range" min="0" max="1" step="0.05" bind:value={rustParams.deform} /></label>

      <label class="field"><span>{t('rust.threshold')} <em>{(rustParams.threshold * 100).toFixed(0)}%</em></span>
        <input type="range" min="0" max="1" step="0.05" bind:value={rustParams.threshold} /></label>

      <label class="field"><span>{t('rust.sharpness')} <em>{(rustParams.sharpness * 100).toFixed(0)}%</em></span>
        <input type="range" min="0" max="1" step="0.05" bind:value={rustParams.sharpness} /></label>

      <label class="field"><span>{t('rust.volume')} <em>{rustParams.volume > 0 ? '+' : ''}{(rustParams.volume * 100).toFixed(0)}%</em></span>
        <input type="range" min="-1" max="1" step="0.05" bind:value={rustParams.volume} /></label>

      {#if getUserMask('rust')}
        <button type="button" class="pos-toggle" onclick={() => posOpen.rust = !posOpen.rust}>
          <span>{t('mask.position')}</span>
          <span class="pos-chev {posOpen.rust ? 'open' : ''}">
            <ChevronDown size={12} />
          </span>
        </button>

        {#if posOpen.rust}
          <div class="pos-panel">
            <label class="field"><span>{t('mask.pos_x')} <em>{settings.userMaskRustPos.offsetX.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={settings.userMaskRustPos.offsetX} onchange={saveSettings} /></label>
            <label class="field"><span>{t('mask.pos_y')} <em>{settings.userMaskRustPos.offsetY.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={settings.userMaskRustPos.offsetY} onchange={saveSettings} /></label>
            <label class="field"><span>{t('mask.rotation')} <em>{settings.userMaskRustPos.rotation.toFixed(0)}°</em></span>
              <input type="range" min="0" max="360" step="1" bind:value={settings.userMaskRustPos.rotation} onchange={saveSettings} /></label>
            <label class="field"><span>{t('mask.scale')} <em>{settings.userMaskRustPos.scale.toFixed(2)}</em></span>
              <input type="range" min="0.05" max="5.0" step="0.05" bind:value={settings.userMaskRustPos.scale} onchange={saveSettings} /></label>
            <button type="button" class="pos-reset" onclick={() => resetUserMaskPos('rust')}>
              <RotateCcw size={11} /> {t('mask.pos_reset')}
            </button>
          </div>
        {/if}
      {:else}
        <button type="button" class="pos-toggle" onclick={() => libPosOpen.rust = !libPosOpen.rust}>
          <span>{t('mask.position')}</span>
          <span class="pos-chev {libPosOpen.rust ? 'open' : ''}">
            <ChevronDown size={12} />
          </span>
        </button>

        {#if libPosOpen.rust}
          <div class="pos-panel">
            <label class="field"><span>{t('spots.pos_x')} <em>{rustParams.posX.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={rustParams.posX} /></label>
            <label class="field"><span>{t('spots.pos_y')} <em>{rustParams.posY.toFixed(2)}</em></span>
              <input type="range" min="-1" max="1" step="0.01" bind:value={rustParams.posY} /></label>
            <label class="field"><span>{t('spots.rotation')} <em>{rustParams.rotation.toFixed(0)}°</em></span>
              <input type="range" min="0" max="360" step="1" bind:value={rustParams.rotation} /></label>
            <label class="check normal-check"><input type="checkbox" bind:checked={rustParams.randomRotation} /> {t('spots.random_rotation')}</label>
          </div>
        {/if}
      {/if}

      <label class="check normal-check"><input type="checkbox" bind:checked={rustParams.disableTiling} /> {t('params.disable_tiling')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={rustParams.rimHighlight} /> {t('scratch.rim_highlight')}</label>
      <label class="check normal-check"><input type="checkbox" bind:checked={rustParams.normalEnabled} /> {t('scratch.normal_enabled')}</label>
    </CollapsibleGroup>
  {/if}

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
  .params { padding: 12px; background: var(--bg-1); border-left: 1px solid var(--border); overflow-y: auto; flex: 0 0 320px; width: 320px; min-width: 320px; max-width: 320px; user-select: none; }
  .group { margin-bottom: 14px; }
  .group-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .group-head h3 { margin: 0; }
  .group h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-2); margin: 0 0 10px 0; font-weight: 600; }
  .group h4.sub { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-2); margin: 14px 0 6px 0; font-weight: 600; opacity: 0.8; }
  .group h4.sub:first-of-type { margin-top: 6px; }
  .reset-btn-sm { background: transparent; border: none; color: var(--fg-2); cursor: pointer; padding: 2px 6px; border-radius: 4px; }
  .reset-btn-sm:hover { color: var(--accent); background: var(--bg-2); }
  .preset-select { width: 100%; background: var(--bg-2); border: 1px solid var(--border); color: var(--fg-0); padding: 6px 8px; border-radius: 4px; font-family: inherit; font-size: 12px; cursor: pointer; }
  .preset-select:hover { border-color: var(--accent); }
  .preset-select:focus { outline: none; border-color: var(--accent); }
  .preset-select option { background: var(--bg-2); color: var(--fg-0); }
  .field { display: block; margin-bottom: 10px; }
  .field > span { display: flex; justify-content: space-between; font-size: 12px; color: var(--fg-1); margin-bottom: 4px; }
  .field > span em { color: var(--accent); font-style: normal; font-weight: 600; }
  .field small { display: block; color: var(--fg-2); font-size: 10px; margin-top: 3px; }
  .field input[type="number"] { width: 100%; background: var(--bg-2); border: 1px solid var(--border); color: var(--fg-0); padding: 5px 8px; border-radius: 4px; font-family: inherit; font-size: 12px; }
  .field input[type="range"] { width: 100%; accent-color: var(--accent); }
  .check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--fg-1); cursor: pointer; margin-bottom: 8px; }
  .check input { accent-color: var(--accent); }
  .check.loaded input { accent-color: var(--accent); }
  .check:not(.loaded) { opacity: 0.5; cursor: not-allowed; }
  .check.edge-mode { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); color: var(--fg-2); }
  .check.edge-mode.active { color: var(--accent); }
  .check.normal-check { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); color: var(--fg-0); }
  .seed-row { display: flex; gap: 4px; }
  .seed-row input { flex: 1; }
  .seed-row button { background: var(--bg-2); border: 1px solid var(--border); color: var(--fg-0); border-radius: 4px; padding: 0 10px; cursor: pointer; display: flex; align-items: center; }
  .seed-row button:hover { border-color: var(--accent); }
  .variations-row { display: grid; grid-template-columns: 1fr 56px; gap: 8px; align-items: center; }
  .variations-num { text-align: center; padding: 4px 4px !important; }
  .map-row { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
  .map-row .check { flex: 1; margin-bottom: 0; }
  .map-load-btn { background: transparent; border: 1px solid var(--border); color: var(--fg-2); width: 24px; height: 24px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; padding: 0; }
  .map-load-btn:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
  .map-load-btn.has { color: var(--accent); border-color: var(--accent); }
  .map-load-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .color-btn { width: 100%; display: flex; align-items: center; gap: 8px; background: var(--bg-2); border: 1px solid var(--border); color: var(--fg-0); padding: 6px 8px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 12px; }
  .color-btn:hover { border-color: var(--accent); }
  .color-swatch { width: 20px; height: 20px; border-radius: 3px; border: 1px solid var(--border); flex-shrink: 0; }
  .color-hex { color: var(--fg-1); font-family: monospace; font-size: 11px; }

  .color-popover {
    margin-top: 8px;
    padding: 12px;
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    position: relative;
    z-index: 5;
  }

  .mask-load-btn { width: 100%; display: flex; align-items: center; gap: 8px; justify-content: center; background: var(--bg-2); border: 1px dashed var(--border); color: var(--fg-0); padding: 10px 8px; border-radius: 4px; cursor: pointer; font-family: inherit; font-size: 12px; }
  .mask-load-btn:hover { border-color: var(--accent); color: var(--accent); }
  .mask-info { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; padding: 6px 8px; background: var(--bg-2); border-radius: 4px; font-size: 11px; }
  .mask-name { color: var(--fg-0); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
  .mask-kind { color: var(--accent); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }

  .custom-warn {
    font-size: 11px;
    color: var(--fg-2);
    background: rgba(255, 180, 60, 0.1);
    border: 1px solid rgba(255, 180, 60, 0.3);
    padding: 8px 10px;
    border-radius: 4px;
    line-height: 1.4;
  }

  .masks-block {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border);
  }
  .mask-action-btn {
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
  .mask-action-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .mask-action-btn.library {
    color: var(--fg-1);
  }
  .mask-action-btn.library:hover {
    color: var(--accent);
  }
  .library-count {
    margin-left: auto;
    color: var(--accent);
    font-weight: 600;
    font-size: 11px;
  }
  .library-count:empty::before {
    content: '0';
  }

  .user-mask-row {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-2);
    border: 1px solid var(--accent-dim);
    border-radius: 4px;
    padding: 6px 8px;
  }
  .user-mask-name {
    flex: 1;
    color: var(--accent);
    font-size: 11px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .user-mask-clear {
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
  .user-mask-clear:hover { color: var(--danger); background: var(--bg-3); }

  .user-mask-hint {
    font-size: 10px;
    color: var(--fg-2);
    line-height: 1.4;
    padding: 0 2px;
  }

  .hint-inline {
    margin-left: auto;
    color: var(--fg-2);
    font-size: 10px;
    font-style: italic;
  }

  .pos-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-1);
    padding: 7px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: all 0.15s;
    margin-top: 8px;
  }
  .pos-toggle:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
  .pos-chev {
    display: flex;
    align-items: center;
    transition: transform 0.15s;
  }
  .pos-chev.open {
    transform: rotate(180deg);
  }
  .pos-panel {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 8px;
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  .pos-reset {
    margin-top: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-1);
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
  }
  .pos-reset:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  .field.disabled { opacity: 0.4; pointer-events: none; }

  .mode-switch {
    display: flex;
    gap: 0;
    margin-bottom: 14px;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }
  .mode-switch button {
    flex: 1;
    background: var(--bg-2);
    border: none;
    color: var(--fg-1);
    padding: 8px 10px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.15s;
  }
  .mode-switch button:hover { color: var(--accent); }
  .mode-switch button.active {
    background: var(--accent);
    color: #141414;
  }
  .mode-switch button + button {
    border-left: 1px solid var(--border);
  }

  .exit-decal-btn {
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
  .exit-decal-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
</style>