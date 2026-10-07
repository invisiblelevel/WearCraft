<script>
  import { ChevronDown, RotateCcw } from '@lucide/svelte';
  import RangeField from './RangeField.svelte';
  import CheckField from './CheckField.svelte';
  import { t } from '../../i18n.svelte.js';
  import { settings, resetUserMaskPos } from '../../lib/stores.svelte.js';

  let {
    open = $bindable(false),
    mode = 'library',              // 'library' | 'user'
    posX = $bindable(0),
    posY = $bindable(0),
    rotation = $bindable(0),
    randomRotation = $bindable(false),
    showRandomRotation = true,
    userPosKey = '',               // 'dirt' | 'rust' | 'streaks' | 'scratches'
    onsave = () => {},
  } = $props();

  const userPos = $derived(
    userPosKey
      ? settings['userMask' + userPosKey.charAt(0).toUpperCase() + userPosKey.slice(1) + 'Pos']
      : null
  );
</script>

<button type="button" class="pos-toggle" onclick={() => open = !open}>
  <span>{t('mask.position')}</span>
  <span class="pos-chev" class:open>
    <ChevronDown size={12} />
  </span>
</button>

{#if open}
  <div class="pos-panel">
    {#if mode === 'user' && userPos}
      <label class="field"><span>{t('mask.pos_x')} <em>{userPos.offsetX.toFixed(2)}</em></span>
        <input type="range" min="-1" max="1" step="0.01" bind:value={userPos.offsetX} onchange={onsave} /></label>
      <label class="field"><span>{t('mask.pos_y')} <em>{userPos.offsetY.toFixed(2)}</em></span>
        <input type="range" min="-1" max="1" step="0.01" bind:value={userPos.offsetY} onchange={onsave} /></label>
      <label class="field"><span>{t('mask.rotation')} <em>{userPos.rotation.toFixed(0)}°</em></span>
        <input type="range" min="0" max="360" step="1" bind:value={userPos.rotation} onchange={onsave} /></label>
      <label class="field"><span>{t('mask.scale')} <em>{userPos.scale.toFixed(2)}</em></span>
        <input type="range" min="0.05" max="5.0" step="0.05" bind:value={userPos.scale} onchange={onsave} /></label>
      <button type="button" class="pos-reset" onclick={() => resetUserMaskPos(userPosKey)}>
        <RotateCcw size={11} /> {t('mask.pos_reset')}
      </button>
    {:else}
      <RangeField label={t('spots.pos_x')} bind:value={posX} min={-1} max={1} step={0.01} />
      <RangeField label={t('spots.pos_y')} bind:value={posY} min={-1} max={1} step={0.01} />
      <RangeField label={t('spots.rotation')} bind:value={rotation} min={0} max={360} step={1} format={(v) => v.toFixed(0) + '°'} />
      {#if showRandomRotation}
        <CheckField label={t('spots.random_rotation')} bind:checked={randomRotation} variant="normal" />
      {/if}
    {/if}
  </div>
{/if}

<style>
  :global(.pos-toggle) {
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
  :global(.pos-toggle:hover) {
    border-color: var(--accent);
    color: var(--accent);
  }
  :global(.pos-chev) {
    display: flex;
    align-items: center;
    transition: transform 0.15s;
  }
  :global(.pos-chev.open) {
    transform: rotate(180deg);
  }
  :global(.pos-panel) {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 8px;
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 4px;
  }
  :global(.pos-reset) {
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
  :global(.pos-reset:hover) {
    color: var(--accent);
    border-color: var(--accent);
  }
</style>