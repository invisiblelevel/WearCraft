<script>
  import { t } from './i18n.svelte.js';
  import { invoke } from '@tauri-apps/api/core';

  let { open = false, onclose } = $props();
  let tab = $state('about'); // 'about' | 'version' | 'support' | 'manual'

  async function openManual() {
    try {
      await invoke('open_manual');
    } catch (e) {
      console.error('Manual open error:', e);
      alert('Не удалось открыть мануал:\n' + e);
    }
  }
</script>

{#if open}
  <div class="backdrop" onclick={onclose} role="presentation"></div>
  <div class="modal" role="dialog" aria-modal="true">
    <header class="modal-head">
      <div class="tabs">
        <button type="button" class:active={tab === 'about'}   onclick={() => tab = 'about'}>   {t('info.tab.about')}   </button>
        <button type="button" class:active={tab === 'version'} onclick={() => tab = 'version'}> {t('info.tab.version')} </button>
        <button type="button" class:active={tab === 'support'} onclick={() => tab = 'support'}> {t('info.tab.support')} </button>
        <button type="button" class:active={tab === 'manual'}  onclick={() => tab = 'manual'}>  {t('info.tab.manual')}  </button>
      </div>
      <button type="button" class="close" onclick={onclose} aria-label="Close">✕</button>
    </header>

    <div class="modal-body">
      {#if tab === 'about'}
        <h2>{t('info.about.title')}</h2>
        <p>{t('info.about.body')}</p>
        <ul class="feat">
          <li>{t('info.about.feat1')}</li>
          <li>{t('info.about.feat2')}</li>
          <li>{t('info.about.feat3')}</li>
        </ul>

      {:else if tab === 'version'}
        <h2>{t('info.version.title')}</h2>
        <table class="kv">
          <tbody>
            <tr><td>{t('info.version.app')}</td>      <td>WearCraft v1.1.1</td></tr>
            <tr><td>{t('info.version.date')}</td>     <td>2026-10-06</td></tr>
            <tr><td>{t('info.version.author')}</td>   <td>INV.LVL</td></tr>
            <tr><td>{t('info.version.stack')}</td>    <td>Tauri + Svelte + Three.js</td></tr>
            <tr><td>{t('info.version.license')}</td>  <td>MIT</td></tr>
          </tbody>
        </table>

      {:else if tab === 'support'}
        <h2>{t('info.support.title')}</h2>
        <p>{t('info.support.body')}</p>

        <div class="wallet">
          <span class="wallet-label">BTC</span>
          <div class="addr">
            <code>bc1q2ka70s4vtmrskandqj8l4d6n3kdxyxa7kf3wf7</code>
            <button type="button" onclick={() => navigator.clipboard.writeText('bc1q2ka70s4vtmrskandqj8l4d6n3kdxyxa7kf3wf7')}>📋</button>
          </div>
        </div>

        <div class="wallet">
          <span class="wallet-label">USDT (TRC-20)</span>
          <div class="addr">
            <code>TUjY9p6oxKmeCQwNZwMfHqHdXuabaHpgT7</code>
            <button type="button" onclick={() => navigator.clipboard.writeText('TUjY9p6oxKmeCQwNZwMfHqHdXuabaHpgT7')}>📋</button>
          </div>
        </div>

      {:else if tab === 'manual'}
        <h2>{t('info.manual.title')}</h2>
        <p>{t('info.manual.body')}</p>
        <button type="button" class="manual-btn" onclick={openManual}>
          {t('info.manual.open')}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(2px);
    z-index: 100;
  }
  .modal {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: min(560px, 90vw);
    max-height: 80vh;
    background: var(--bg-1, #1a1a1a);
    border: 1px solid var(--border, #2e2e2e);
    border-radius: 10px;
    z-index: 101;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  }
  .modal-head {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border, #2e2e2e);
    padding: 0 8px 0 4px;
  }
  .tabs { display: flex; flex: 1; }
  .tabs button {
    background: transparent;
    border: none;
    color: var(--fg-2, #707070);
    padding: 12px 16px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .tabs button:hover { color: var(--fg-0, #e8e8e8); }
  .tabs button.active {
    color: var(--accent, #f0a020);
    border-bottom-color: var(--accent, #f0a020);
  }
  .close {
    background: transparent;
    border: none;
    color: var(--fg-2, #707070);
    font-size: 16px;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 4px;
  }
  .close:hover { color: var(--fg-0, #e8e8e8); background: var(--bg-2, #202020); }

  .modal-body {
    padding: 20px 24px;
    overflow-y: auto;
    color: var(--fg-1, #b0b0b0);
    font-size: 13px;
    line-height: 1.5;
  }
  .modal-body h2 {
    margin: 0 0 12px;
    font-size: 15px;
    color: var(--fg-0, #e8e8e8);
  }
  .modal-body p { margin: 0 0 12px; }
  .feat { margin: 0; padding-left: 18px; }
  .feat li { margin-bottom: 4px; }

  .kv { width: 100%; border-collapse: collapse; }
  .kv td {
    padding: 6px 0;
    border-bottom: 1px solid var(--border, #2e2e2e);
  }
  .kv td:first-child {
    color: var(--fg-2, #707070);
    width: 40%;
  }
  .kv td:last-child { color: var(--fg-0, #e8e8e8); }

  .wallet { margin-bottom: 16px; }
  .wallet-label {
    display: block;
    font-size: 11px;
    color: var(--fg-2, #707070);
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .addr { display: flex; gap: 6px; }
  .addr code {
    flex: 1;
    background: var(--bg-2, #202020);
    border: 1px solid var(--border, #2e2e2e);
    border-radius: 4px;
    padding: 8px 10px;
    font-family: 'Cascadia Mono', Consolas, monospace;
    font-size: 12px;
    color: var(--accent, #f0a020);
    word-break: break-all;
  }
  .addr button {
    background: var(--bg-2, #202020);
    border: 1px solid var(--border, #2e2e2e);
    border-radius: 4px;
    padding: 0 12px;
    cursor: pointer;
    color: var(--fg-1, #b0b0b0);
  }
  .addr button:hover { border-color: var(--accent, #f0a020); color: var(--accent, #f0a020); }

  .manual-btn {
    background: var(--accent, #f0a020);
    border: none;
    color: #141414;
    padding: 10px 20px;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    margin-top: 8px;
  }
  .manual-btn:hover { background: #ffb84d; }
</style>