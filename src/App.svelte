<script>
  import { onMount, onDestroy } from 'svelte';
  import { initI18n, i18n } from './i18n.svelte.js';
  import InfoModal from './InfoModal.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import SaveModal from './components/SaveModal.svelte';
  import ConflictModal from './components/ConflictModal.svelte';
  import MasksLibraryModal from './components/MasksLibraryModal.svelte';
  import MasksInfoModal from './components/MasksInfoModal.svelte';
  import TopBar from './components/TopBar.svelte';
  import Rail from './components/Rail.svelte';
  import Preview3D from './components/Preview3D.svelte';
  import ParamsPanel from './components/ParamsPanel.svelte';
  import LogPanel from './components/LogPanel.svelte';
  import ProgressBar from './components/ProgressBar.svelte';
  import Toasts from './components/Toasts.svelte';

  import { initActions } from './lib/actions.svelte.js';
  import { initDragDrop, destroyDragDrop } from './lib/drag-drop.js';
  import { ui, settings, saveSettings } from './lib/stores.svelte.js';
  import { initHotkeys, destroyHotkeys } from './lib/hotkeys.js';

  onMount(async () => {
    await initI18n();
    await initDragDrop();
    initHotkeys();
  });

  onDestroy(() => {
    destroyDragDrop();
    destroyHotkeys();
  });

  function onSceneReady(e) {
    initActions(e.detail.scene);
  }

  // Автосохранение zoom в settings + localStorage
  let zoomSaveTimer = null;
  $effect(() => {
    const z = ui.zoom;
    if (Math.abs((settings.uiZoom || 1.0) - z) < 0.001) return;
    settings.uiZoom = z;
    if (zoomSaveTimer) clearTimeout(zoomSaveTimer);
    zoomSaveTimer = setTimeout(() => saveSettings(), 300);
  });
</script>

<svelte:window on:wearcraft:scene-ready={onSceneReady} />

{#if i18n.ready}
<div
  class="app"
  style="zoom: {ui.zoom}; width: calc(100vw / {ui.zoom}); height: calc(100vh / {ui.zoom});"
>

  <TopBar />

  <main class="main">
    <Rail />
    <Preview3D />
    <ParamsPanel />
  </main>

  <ProgressBar />
  <LogPanel />

  <InfoModal open={ui.infoOpen} onclose={() => ui.infoOpen = false} />
  <SettingsModal />
  <SaveModal />
  <ConflictModal />
  <MasksLibraryModal />
  <MasksInfoModal preset={ui.pendingMasksLibrary || ui.masksLibraryOpen || 'rust'} />
  <Toasts />
</div>
{/if}

<style>
  :global(*, *::before, *::after) { box-sizing: border-box; }

  :global(:root) {
    --bg-0: #141414; --bg-1: #1a1a1a; --bg-2: #202020; --bg-3: #272727;
    --border: #2e2e2e; --fg-0: #e8e8e8; --fg-1: #b0b0b0; --fg-2: #707070;
    --accent: #f0a020; --accent-dim: #a06a10;
    --danger: #e04040; --success: #40c060;
  }
  :global(html, body) {
    margin: 0; padding: 0; height: 100%;
    background: var(--bg-0); color: var(--fg-0);
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 13px; overflow: hidden;
  }
  :global(#app) {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  :global(::-webkit-scrollbar) { width: 8px; height: 8px; }
  :global(::-webkit-scrollbar-track) { background: transparent; }
  :global(::-webkit-scrollbar-thumb) {
    background: var(--bg-3);
    border-radius: 4px;
    border: 2px solid var(--bg-1);
  }
  :global(::-webkit-scrollbar-thumb:hover) { background: var(--accent-dim); }
  :global(::-webkit-scrollbar-corner) { background: transparent; }

  .app {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-0);
  }

  .main {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    width: 100%;
    overflow: hidden;
  }
</style>