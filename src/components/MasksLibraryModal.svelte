<script>
  import { X, FolderOpen, RotateCcw, CheckSquare, Square, Info, FileQuestion } from '@lucide/svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { t } from '../i18n.svelte.js';
  import {
    ui, settings,
    getFolderMaskNames, toggleFolderMask, clearFolderMasks, selectAllFolderMasks,
    pushLog, pushToast,
  } from '../lib/stores.svelte.js';

  let files = $state([]);        // список имён файлов из папки
  let loading = $state(false);
  let folderPath = $state('');
  let error = $state('');

  let preset = $derived(ui.masksLibraryOpen || 'rust');
  let selected = $derived(getFolderMaskNames(preset));

  // Загрузка списка при открытии
  $effect(() => {
    if (!ui.masksLibraryOpen) return;
    const p = ui.masksLibraryOpen;
    loadFiles(p);
  });

  async function loadFiles(p) {
    loading = true;
    error = '';
    files = [];
    folderPath = '';
    try {
      folderPath = await invoke('get_user_masks_path', { subfolder: p });
      files = await invoke('list_masks_in_folder', { subfolder: p });
      pushLog(`[Masks] Загружено из папки ${p}: ${files.length} шт.`);
    } catch (e) {
      error = String(e);
      pushLog(`[Masks] Ошибка загрузки папки: ${e}`);
    } finally {
      loading = false;
    }
  }

  function close() {
    ui.masksLibraryOpen = null;
  }

  function openFolder() {
    invoke('open_user_masks_folder', { subfolder: preset }).catch(e => {
      pushToast(`Не удалось открыть папку: ${e}`, 'error');
    });
  }

  function openInfo() {
    ui.masksInfoOpen = true;
  }

  function isSelected(name) {
    return selected.includes(name);
  }

  function selectAll() {
    selectAllFolderMasks(preset, files);
    pushLog(`[Masks] Выбраны все (${files.length}) для ${preset}`);
  }

  function clearAll() {
    clearFolderMasks(preset);
    pushLog(`[Masks] Сброшены все галочки для ${preset}`);
  }

  async function reload() {
    await loadFiles(preset);
    pushToast('Список обновлён', 'info');
  }
</script>

{#if ui.masksLibraryOpen}
  <div class="backdrop" onclick={close} role="presentation"></div>
  <div class="modal" role="dialog" aria-modal="true">
    <header class="modal-head">
      <h2>{t('masks_lib.title')} — {preset === 'rust' ? t('preset.rust') : t('preset.dirt')}</h2>
      <div class="head-actions">
        <button type="button" class="icon-btn" onclick={openInfo} title={t('masks_info.title')}>
          <Info size={14} />
        </button>
        <button type="button" class="close" onclick={close} aria-label="Close">
          <X size={16} />
        </button>
      </div>
    </header>

    <div class="modal-body">
      {#if loading}
        <div class="state">{t('masks_lib.loading')}</div>
      {:else if error}
        <div class="state error">{error}</div>
      {:else if files.length === 0}
        <div class="empty">
          <FileQuestion size={32} />
          <div class="empty-text">{t('masks_lib.empty')}</div>
          <div class="empty-hint">{t('masks_lib.empty_hint')}</div>
          <button type="button" class="btn-secondary" onclick={openFolder}>
            <FolderOpen size={14} />
            {t('masks_lib.open_folder')}
          </button>
        </div>
      {:else}
        <div class="toolbar">
          <button type="button" class="btn-secondary" onclick={selectAll}>
            <CheckSquare size={13} />
            {t('masks_lib.select_all')}
          </button>
          <button type="button" class="btn-secondary" onclick={clearAll}>
            <Square size={13} />
            {t('masks_lib.clear_all')}
          </button>
          <button type="button" class="btn-secondary" onclick={reload} title={t('masks_lib.reload')}>
            <RotateCcw size={13} />
          </button>
          <button type="button" class="btn-secondary open-folder" onclick={openFolder} title={t('masks_lib.open_folder')}>
            <FolderOpen size={13} />
          </button>
        </div>

        <ul class="files-list">
          {#each files as name (name)}
            <li class="file-row">
              <label class="file-label">
                <input
                  type="checkbox"
                  checked={isSelected(name)}
                  onchange={() => toggleFolderMask(preset, name)}
                />
                <span class="file-name">{name}</span>
              </label>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <footer class="modal-foot">
      <div class="counter">
        {t('masks_lib.selected')}: <strong>{selected.length}</strong> / {files.length}
      </div>
      <button type="button" class="btn-primary" onclick={close}>{t('masks_lib.done')}</button>
    </footer>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(2px);
    z-index: 1000;
  }
  .modal {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: min(480px, 90vw);
    max-height: 80vh;
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    z-index: 1001;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0,0,0,0.7);
  }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 12px 12px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 8px;
  }
  .modal-head h2 {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--fg-2);
    font-weight: 600;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .head-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }
  .icon-btn, .close {
    background: transparent;
    border: none;
    color: var(--fg-2);
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }
  .icon-btn:hover, .close:hover {
    color: var(--accent);
    background: var(--bg-2);
  }

  .modal-body {
    padding: 14px 16px;
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 200px;
  }

  .state {
    padding: 30px;
    text-align: center;
    color: var(--fg-2);
    font-size: 12px;
  }
  .state.error { color: var(--danger); }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 30px 20px;
    color: var(--fg-2);
    text-align: center;
  }
  .empty-text { font-size: 13px; color: var(--fg-1); }
  .empty-hint { font-size: 11px; max-width: 320px; line-height: 1.5; }

  .toolbar {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border);
  }
  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-1);
    padding: 5px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    transition: all 0.15s;
  }
  .btn-secondary:hover {
    color: var(--accent);
    border-color: var(--accent);
  }
  .btn-secondary.open-folder { margin-left: auto; }

  .files-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .file-row {
    padding: 0;
  }
  .file-label {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    color: var(--fg-0);
    transition: background 0.1s;
  }
  .file-label:hover {
    background: var(--bg-2);
  }
  .file-label input[type="checkbox"] {
    accent-color: var(--accent);
    cursor: pointer;
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }
  .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .modal-foot {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    gap: 12px;
  }
  .counter {
    font-size: 11px;
    color: var(--fg-2);
  }
  .counter strong {
    color: var(--accent);
    font-weight: 600;
  }
  .btn-primary {
    background: var(--accent);
    color: var(--bg-0);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 7px 18px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary:hover { opacity: 0.9; }
</style>