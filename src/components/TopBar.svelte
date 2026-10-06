<script>
  import { Info } from '@lucide/svelte';
  import { setLocale, t, i18n } from '../i18n.svelte.js';
  import { ui } from '../lib/stores.svelte.js';
</script>

<header class="topbar">
  <div class="brand">
    <span class="dot"></span>
    <span class="name">{t('app.title')}</span>
    <span class="ver">{t('app.version')}</span>
  </div>
  <div class="topbar-actions">
    <button type="button" class="icon-btn" title={t('menu.about')} onclick={() => ui.infoOpen = true}>
      <Info size={16} />
    </button>
    <div class="lang-switch">
      <button type="button" class:active={i18n.locale === 'ru'} onclick={() => setLocale('ru')}>RU</button>
      <button type="button" class:active={i18n.locale === 'en'} onclick={() => setLocale('en')}>EN</button>
      <button type="button" class:active={i18n.locale === 'zh'} onclick={() => setLocale('zh')}>中文</button>
    </div>
  </div>
</header>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--border);
  }
  .brand { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  .brand .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
  }
  .brand .ver { color: var(--fg-2); font-weight: 400; font-size: 11px; }

  .topbar-actions { display: flex; align-items: center; gap: 8px; }

  .icon-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-1);
    width: 28px; height: 28px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-btn:hover { color: var(--accent); border-color: var(--accent); }

  .lang-switch { display: flex; gap: 2px; }
  .lang-switch button {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg-1);
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
  }
  .lang-switch button:hover { color: var(--fg-0); border-color: var(--fg-2); }
  .lang-switch button.active {
    background: var(--accent);
    color: #141414;
    border-color: var(--accent);
    font-weight: 600;
  }
</style>