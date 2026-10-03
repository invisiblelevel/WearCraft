<script>
  import { X, Monitor, Save, FolderOpen, RefreshCw, Trash2 } from '@lucide/svelte';
  import { t } from '../i18n.svelte.js';
  import { settings, saveSettings, resetSettings, ui, pbr, pushToast, pushLog } from '../lib/stores.svelte.js';
  import { open } from '@tauri-apps/plugin-dialog';
  import { clearVariationCache, loadVariation } from '../lib/variation-loader.js';
  import { applyPBR } from '../lib/pbr-loader.js';

  let tab = $state('performance');

  function close() {
    ui.settingsOpen = false;
  }

  // Сброс текстур из GPU + кэша
  function disposeAllTextures() {
    // Dispose всех текстур в pbr.textures
    Object.values(pbr.textures).forEach((tex) => {
      if (tex && tex.dispose) {
        try { tex.dispose(); } catch (e) { /* ignore */ }
      }
    });
    // Очищаем кэш вариаций
    clearVariationCache();
  }

  // Перезагрузить текущий вид
  async function reloadView() {
    if (ui.currentVariation === 0) {
      applyPBR();
    } else if (ui.generated.length > 0) {
      await loadVariation(ui.currentVariation);
    }
  }

  function onResolutionChange(value) {
    if (settings.previewResolution === value) return;
    settings.previewResolution = value;
    saveSettings();

    // Авто-перезагрузка: dispose старых + перезагрузить
    disposeAllTextures();
    // Небольшая задержка чтоб UI обновился
    setTimeout(() => {
      reloadView();
      pushLog(`[Settings] Preview resolution → ${value === 0 ? 'Full' : value}`);
    }, 50);
  }

  async function onClearCache() {
    disposeAllTextures();
    await reloadView();
    pushLog('[Settings] Кэш текстур очищен');
    pushToast('Кэш очищен', 'success');
  }

  function onSaveModeChange(mode) {
    settings.saveMode = mode;
    saveSettings();
  }

  async function pickSaveDir() {
    const picked = await open({ directory: true, multiple: false });
    if (picked) {
      settings.saveDir = picked;
      saveSettings();
    }
  }

  function onReset() {
    resetSettings();
    pushLog('[Settings] Настройки сброшены');
  }
</script>

{#if ui.settingsOpen}
  <div class="backdrop" onclick={close} role="presentation"></div>
  <div class="modal" role="dialog" aria-modal="true">
    <header class="modal-head">
      <div class="tabs">
        <button class:active={tab === 'performance'} onclick={() => tab = 'performance'}>
          <Monitor size={14} /> {t('settings.tab.performance')}
        </button>
        <button class:active={tab === 'saving'} onclick={() => tab = 'saving'}>
          <Save size={14} /> {t('settings.tab.saving')}
        </button>
      </div>
      <button class="close" onclick={close} aria-label="Close">
        <X size={16} />
      </button>
    </header>

    <div class="modal-body">
      {#if tab === 'performance'}
        <h2>{t('settings.performance.title')}</h2>

        <div class="setting-row">
          <div class="setting-label">
            <div class="setting-name">{t('settings.preview_resolution')}</div>
            <div class="setting-hint">{t('settings.preview_resolution.hint')}</div>
          </div>
          <div class="setting-control">
            <select value={settings.previewResolution} onchange={(e) => onResolutionChange(Number(e.currentTarget.value))}>
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
              <option value={0}>{t('settings.resolution.full')}</option>
            </select>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-label">
            <div class="setting-name">{t('settings.clear_cache')}</div>
            <div class="setting-hint">{t('settings.clear_cache.hint')}</div>
          </div>
          <div class="setting-control">
            <button class="action-btn" onclick={onClearCache}>
              <Trash2 size={14} /> {t('settings.clear_cache.btn')}
            </button>
          </div>
        </div>

      {:else if tab === 'saving'}
        <h2>{t('settings.saving.title')}</h2>

        <div class="setting-row">
          <div class="setting-label">
            <div class="setting-name">{t('settings.save_mode')}</div>
            <div class="setting-hint">{t('settings.save_mode.hint')}</div>
          </div>
          <div class="setting-control">
            <div class="radio-group">
              <label class="radio">
                <input type="radio" name="saveMode" value="ask" checked={settings.saveMode === 'ask'} onchange={() => onSaveModeChange('ask')} />
                {t('settings.save_mode.ask')}
              </label>
              <label class="radio">
                <input type="radio" name="saveMode" value="always" checked={settings.saveMode === 'always'} onchange={() => onSaveModeChange('always')} />
                {t('settings.save_mode.always')}
              </label>
            </div>
          </div>
        </div>

        {#if settings.saveMode === 'always'}
          <div class="setting-row">
            <div class="setting-label">
              <div class="setting-name">{t('settings.save_dir')}</div>
              <div class="setting-hint">{t('settings.save_dir.hint')}</div>
            </div>
            <div class="setting-control">
              <button class="dir-btn" onclick={pickSaveDir}>
                <FolderOpen size={14} />
                {settings.saveDir ? settings.saveDir : t('settings.save_dir.pick')}
              </button>
            </div>
          </div>
        {/if}
      {/if}
    </div>

    <footer class="modal-foot">
      <button class="reset-btn" onclick={onReset}>
        <RefreshCw size={14} /> {t('settings.reset')}
      </button>
      <button class="close-btn" onclick={close}>{t('settings.close')}</button>
    </footer>
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
    width: min(640px, 90vw);
    max-height: 80vh;
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    z-index: 201;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0,0,0,0.7);
  }
  .modal-head {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding: 0 8px 0 4px;
  }
  .tabs { display: flex; flex: 1; }
  .tabs button {
    background: transparent;
    border: none;
    color: var(--fg-2);
    padding: 12px 16px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tabs button:hover { color: var(--fg-0); }
  .tabs button.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }
  .close {
    background: transparent; border: none;
    color: var(--fg-2); cursor: pointer;
    padding: 6px 10px; border-radius: 4px;
    display: flex; align-items: center;
  }
  .close:hover { color: var(--fg-0); background: var(--bg-2); }

  .modal-body {
    padding: 20px 24px;
    overflow-y: auto;
    color: var(--fg-1);
    font-size: 13px;
    flex: 1;
  }
  .modal-body h2 {
    margin: 0 0 16px;
    font-size: 13px;
    color: var(--fg-0);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
  }

  .setting-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 16px;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .setting-row:last-child { border-bottom: none; }
  .setting-label { display: flex; flex-direction: column; gap: 4px; }
  .setting-name { font-size: 13px; color: var(--fg-0); }
  .setting-hint { font-size: 11px; color: var(--fg-2); }

  .setting-control select {
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-0);
    padding: 6px 10px;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    min-width: 120px;
  }
  .setting-control select:hover { border-color: var(--accent); }

  .action-btn {
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-0);
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    display: flex; align-items: center; gap: 6px;
  }
  .action-btn:hover { color: var(--accent); border-color: var(--accent); }

  .radio-group { display: flex; flex-direction: column; gap: 6px; }
  .radio {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: var(--fg-1);
    cursor: pointer;
  }
  .radio input { accent-color: var(--accent); }

  .dir-btn {
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-0);
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    display: flex; align-items: center; gap: 6px;
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dir-btn:hover { border-color: var(--accent); color: var(--accent); }

  .modal-foot {
    display: flex;
    justify-content: space-between;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
  }
  .reset-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-1);
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    display: flex; align-items: center; gap: 6px;
  }
  .reset-btn:hover { color: var(--accent); border-color: var(--accent); }

  .close-btn {
    background: var(--accent);
    border: 1px solid var(--accent);
    color: #141414;
    padding: 6px 20px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
  }
  .close-btn:hover { opacity: 0.9; }
</style>