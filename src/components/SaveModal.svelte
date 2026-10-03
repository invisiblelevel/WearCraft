<script>
  import { X, Image, Archive, Box, Loader2, Gamepad2 } from '@lucide/svelte';
  import { t } from '../i18n.svelte.js';
  import { ui, pbr, viewer } from '../lib/stores.svelte.js';
  import { onSavePBR, onSaveZIP, onSaveOBJ, onSaveUnreal, onSaveUnity } from '../lib/actions.svelte.js';

  let unityPipeline = $state('builtin'); // 'builtin' | 'urp'

  function close() {
    if (ui.busy) return;
    ui.saveOpen = false;
  }

  let hasPbr = $derived(Object.keys(pbr.textures).length > 0);
  let hasObject = $derived(!!(viewer.loadedModel || viewer.mesh));
  let isSaving = $derived(ui.saveProgress.visible);

  function saveUnreal() {
    onSaveUnreal();
  }
  function saveUnity() {
    onSaveUnity(unityPipeline);
  }
</script>

{#if ui.saveOpen}
  <div class="backdrop" onclick={close} role="presentation"></div>
  <div class="modal" role="dialog" aria-modal="true">
    <header class="modal-head">
      <h2>{t('save.title')}</h2>
      <button class="close" onclick={close} disabled={ui.busy} aria-label="Close">
        <X size={16} />
      </button>
    </header>

    <div class="modal-body">
      {#if isSaving}
        <div class="progress-view">
          <div class="progress-icon">
            <Loader2 size={32} class="spin" />
          </div>
          <div class="progress-label">{ui.saveProgress.label}</div>
          <div class="progress-track">
            <div class="progress-fill" style="width: {(ui.saveProgress.value * 100).toFixed(1)}%"></div>
          </div>
          <div class="progress-percent">{(ui.saveProgress.value * 100).toFixed(0)}%</div>
        </div>
      {:else}
        <!-- ═══ Оригинальные карты ═══ -->
        <button class="save-card" disabled={!hasPbr || ui.busy} onclick={onSavePBR}>
          <div class="card-icon"><Image size={22} /></div>
          <div class="card-info">
            <div class="card-name">{t('save.pbr.name')}</div>
            <div class="card-desc">{t('save.pbr.desc')}</div>
          </div>
          <div class="card-action">{t('save.action')}</div>
        </button>

        <button class="save-card" disabled={!hasPbr || ui.busy} onclick={onSaveZIP}>
          <div class="card-icon"><Archive size={22} /></div>
          <div class="card-info">
            <div class="card-name">{t('save.zip.name')}</div>
            <div class="card-desc">{t('save.zip.desc')}</div>
          </div>
          <div class="card-action">{t('save.action')}</div>
        </button>

        <button class="save-card" disabled={!hasObject || ui.busy} onclick={onSaveOBJ}>
          <div class="card-icon"><Box size={22} /></div>
          <div class="card-info">
            <div class="card-name">{t('save.obj.name')}</div>
            <div class="card-desc">{t('save.obj.desc')}</div>
          </div>
          <div class="card-action">{t('save.action')}</div>
        </button>

        <!-- ═══ Движки ═══ -->
        <div class="engine-group">
          <div class="engine-label">
            <Gamepad2 size={14} />
            <span>{t('save.engines.title')}</span>
          </div>

          <button class="save-card engine" disabled={!hasPbr || ui.busy} onclick={saveUnreal}>
            <div class="card-icon engine-icon"><Gamepad2 size={22} /></div>
            <div class="card-info">
              <div class="card-name">{t('save.unreal.name')}</div>
              <div class="card-desc">{t('save.unreal.desc')}</div>
            </div>
            <div class="card-action">{t('save.action')}</div>
          </button>

          <button class="save-card engine" disabled={!hasPbr || ui.busy} onclick={saveUnity}>
            <div class="card-icon engine-icon"><Gamepad2 size={22} /></div>
            <div class="card-info">
              <div class="card-name">{t('save.unity.name')}</div>
              <div class="card-desc">{t('save.unity.desc')}</div>
            </div>
            <div class="card-action">{t('save.action')}</div>
          </button>

          <div class="engine-pipeline">
            <label class="pipe-radio">
              <input type="radio" value="builtin" bind:group={unityPipeline} />
              <span>{t('save.unity.builtin')}</span>
            </label>
            <label class="pipe-radio">
              <input type="radio" value="urp" bind:group={unityPipeline} />
              <span>{t('save.unity.urp')}</span>
            </label>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(2px);
    z-index: 200;
  }
  .modal {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: min(520px, 90vw);
    max-height: 90vh;
    overflow-y: auto;
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    z-index: 201;
    box-shadow: 0 24px 64px rgba(0,0,0,0.7);
  }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--bg-1);
    z-index: 1;
  }
  .modal-head h2 {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-2);
    font-weight: 600;
  }
  .close {
    background: transparent; border: none;
    color: var(--fg-2); cursor: pointer;
    padding: 4px 8px; border-radius: 4px;
    display: flex; align-items: center;
  }
  .close:hover:not(:disabled) { color: var(--fg-0); background: var(--bg-2); }
  .close:disabled { opacity: 0.3; cursor: not-allowed; }

  .modal-body {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .save-card {
    display: grid;
    grid-template-columns: 44px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 14px 16px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: inherit;
    transition: all 0.15s;
  }
  .save-card:hover:not(:disabled) {
    border-color: var(--accent);
    background: var(--bg-3);
  }
  .save-card:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--accent);
    width: 44px; height: 44px;
    background: var(--bg-1);
    border-radius: 8px;
  }
  .engine-icon {
    background: rgba(240, 160, 32, 0.1);
  }

  .card-info { display: flex; flex-direction: column; gap: 3px; }
  .card-name { font-size: 13px; color: var(--fg-0); font-weight: 600; }
  .card-desc { font-size: 11px; color: var(--fg-2); }

  .card-action {
    font-size: 11px;
    color: var(--accent);
    font-weight: 600;
    padding: 5px 10px;
    border: 1px solid var(--accent);
    border-radius: 4px;
  }
  .save-card:disabled .card-action {
    color: var(--fg-2);
    border-color: var(--border);
  }

  /* ═══ Секция движков ═══ */
  .engine-group {
    margin-top: 4px;
    padding: 12px;
    background: rgba(240, 160, 32, 0.04);
    border: 1px solid var(--accent-dim);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .engine-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--accent);
    font-weight: 600;
    margin-bottom: 2px;
  }
  .engine-group .save-card {
    background: var(--bg-2);
  }

  .engine-pipeline {
    display: flex;
    gap: 16px;
    padding: 8px 6px 2px 6px;
    margin-top: 2px;
    border-top: 1px dashed rgba(240, 160, 32, 0.2);
    font-size: 11px;
    color: var(--fg-1);
  }
  .pipe-radio {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
  }
  .pipe-radio input { accent-color: var(--accent); cursor: pointer; }
  .pipe-radio:hover { color: var(--fg-0); }

  /* Прогресс */
  .progress-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 24px 16px;
  }
  .progress-icon {
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }

  .progress-label {
    font-size: 13px;
    color: var(--fg-0);
    text-align: center;
  }

  .progress-track {
    width: 100%;
    height: 6px;
    background: var(--bg-3);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-dim), var(--accent));
    transition: width 0.2s ease-out;
    box-shadow: 0 0 8px var(--accent-dim);
  }
  .progress-percent {
    font-size: 11px;
    color: var(--fg-2);
  }
</style>