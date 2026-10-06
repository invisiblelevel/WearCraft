<script>
  import { X, FolderOpen, FileImage } from '@lucide/svelte';
  import { t } from '../i18n.svelte.js';
  import { ui, markMasksInfoShown, pushToast } from '../lib/stores.svelte.js';

  let { preset = 'rust' } = $props();

  let showDonate = $state(false);

  function close() {
    markMasksInfoShown();
    ui.masksInfoOpen = false;
    if (ui.pendingMasksLibrary) {
      const p = ui.pendingMasksLibrary;
      ui.pendingMasksLibrary = null;
      ui.masksLibraryOpen = p;
    }
  }

  async function openFolder() {
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      await invoke('open_user_masks_folder', { subfolder: preset });
    } catch (e) {
      pushToast(`Не удалось открыть папку: ${e}`, 'error');
    }
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => {
      pushToast(`${label} скопирован`, 'success');
    }).catch(() => {
      pushToast('Не удалось скопировать', 'error');
    });
  }
</script>

{#if ui.masksInfoOpen}
  <div class="backdrop" onclick={close} role="presentation"></div>
  <div class="modal" role="dialog" aria-modal="true">
    <header class="modal-head">
      <h2>{t('masks_info.title')}</h2>
      <button type="button" class="close" onclick={close} aria-label="Close">
        <X size={16} />
      </button>
    </header>

    <div class="modal-body">
      <p class="intro">{t('masks_info.intro')}</p>

      <section class="block">
        <h3>
          <FolderOpen size={14} />
          {t('masks_info.how_to_title')}
        </h3>
        <ol class="steps">
          <li>{t('masks_info.step1')}</li>
          <li>{t('masks_info.step2')}</li>
          <li>{t('masks_info.step3')}</li>
        </ol>
        <button type="button" class="btn-folder" onclick={openFolder}>
          <FolderOpen size={14} />
          {t('masks_lib.open_folder')}
        </button>
        <div class="hint">{t('masks_info.hint_formats')}</div>
      </section>

      <section class="block">
        <h3>
          <FileImage size={14} />
          {t('masks_info.about_user_mask_title')}
        </h3>
        <p class="text">{t('masks_info.about_user_mask')}</p>
      </section>

      <section class="block support">
        <button type="button" class="donate-toggle" onclick={() => showDonate = !showDonate}>
          <span>{t('masks_info.support_btn')}</span>
          <span class="donate-arrow">{showDonate ? '▲' : '▼'}</span>
        </button>

        {#if showDonate}
          <div class="donate-body">
            <p class="text">{t('info.support.body')}</p>

            <div class="wallet">
              <span class="wallet-label">BTC</span>
              <div class="addr">
                <code>bc1q2ka70s4vtmrskandqj8l4d6n3kdxyxa7kf3wf7</code>
                <button type="button" onclick={() => copyToClipboard('bc1q2ka70s4vtmrskandqj8l4d6n3kdxyxa7kf3wf7', 'BTC')}>📋</button>
              </div>
            </div>

            <div class="wallet">
              <span class="wallet-label">USDT (TRC-20)</span>
              <div class="addr">
                <code>TUjY9p6oxKmeCQwNZwMfHqHdXuabaHpgT7</code>
                <button type="button" onclick={() => copyToClipboard('TUjY9p6oxKmeCQwNZwMfHqHdXuabaHpgT7', 'USDT')}>📋</button>
              </div>
            </div>
          </div>
        {/if}
      </section>
    </div>

    <footer class="modal-foot">
      <button type="button" class="btn-primary" onclick={close}>{t('masks_info.got_it')}</button>
    </footer>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(2px);
    z-index: 1100;
  }
  .modal {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: min(600px, 92vw);
    height: 85vh;
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    z-index: 1101;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0,0,0,0.7);
    overflow: hidden;
  }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
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
    background: transparent;
    border: none;
    color: var(--fg-2);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }
  .close:hover { color: var(--fg-0); background: var(--bg-2); }

  .modal-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 20px 24px;
    color: var(--fg-1);
    font-size: 13px;
    line-height: 1.55;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .intro {
    margin: 0;
    color: var(--fg-0);
    font-size: 14px;
  }

  .block {
    background: var(--bg-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    flex-shrink: 0;
  }
  .block h3 {
    margin: 0 0 10px 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .block .text { margin: 0; }
  .steps {
    margin: 0 0 10px 0;
    padding-left: 20px;
  }
  .steps li { margin-bottom: 4px; }
  .hint {
    font-size: 11px;
    color: var(--fg-2);
    background: var(--bg-1);
    border-left: 2px solid var(--accent);
    padding: 6px 10px;
    border-radius: 3px;
  }

  .btn-folder {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-1);
    border: 1px solid var(--border);
    color: var(--fg-0);
    padding: 7px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    margin-bottom: 10px;
    transition: all 0.15s;
  }
  .btn-folder:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .support {
    border-color: var(--accent-dim);
    background: rgba(240, 160, 32, 0.04);
    padding: 0;
    overflow: hidden;
  }
  .donate-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: transparent;
    border: none;
    color: var(--accent);
    padding: 14px 16px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .donate-toggle:hover {
    background: rgba(240, 160, 32, 0.08);
  }
  .donate-arrow {
    font-size: 10px;
    opacity: 0.7;
  }
  .donate-body {
    padding: 0 16px 14px 16px;
  }

  .wallet { margin-bottom: 12px; }
  .wallet:last-child { margin-bottom: 0; }
  .wallet-label {
    display: block;
    font-size: 11px;
    color: var(--fg-2);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .addr { display: flex; gap: 6px; }
  .addr code {
    flex: 1;
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 8px 10px;
    font-family: 'Cascadia Mono', Consolas, monospace;
    font-size: 12px;
    color: var(--accent);
    word-break: break-all;
  }
  .addr button {
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0 12px;
    cursor: pointer;
    color: var(--fg-1);
    font-size: 14px;
  }
  .addr button:hover { border-color: var(--accent); color: var(--accent); }

  .modal-foot {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
    background: var(--bg-1);
    border-radius: 0 0 10px 10px;
  }
  .btn-primary {
    background: var(--accent);
    color: var(--bg-0);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 8px 18px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary:hover { opacity: 0.9; }
</style>