<script>
  import { t } from '../i18n.svelte.js';
  import { ui, pushLog } from '../lib/stores.svelte.js';

  // Локальный state: выбранные пути для каждого конфликта
  let picks = $state({});

  // Инициализируем picks при открытии
  $effect(() => {
    if (ui.conflicts) {
      const init = {};
      for (const [kind, paths] of Object.entries(ui.conflicts)) {
        init[kind] = paths[0];
      }
      picks = init;
    }
  });

  function basename(path) {
    return path.split(/[\\/]/).pop() || '';
  }

  function confirm() {
    if (!ui.conflictsResolve) return;
    // Формируем resolved: kind -> [выбранный путь]
    const resolved = {};
    for (const [kind, path] of Object.entries(picks)) {
      resolved[kind] = [path];
    }
    ui.conflictsResolve(resolved);
  }

  function cancel() {
    if (!ui.conflictsResolve) return;
    ui.conflictsResolve(null);
    pushLog('[Drop] Отменено пользователем');
  }
</script>

{#if ui.conflicts}
  <div class="conflict-overlay" onclick={cancel}>
    <div class="conflict-modal" onclick={(e) => e.stopPropagation()}>
      <div class="conflict-head">
        <h3>{t('drop.conflict_title')}</h3>
        <p>{t('drop.conflict_hint')}</p>
      </div>
      <div class="conflict-body">
        {#each Object.entries(ui.conflicts) as [kind, paths]}
          <div class="conflict-group">
            <div class="conflict-kind">{kind.toUpperCase()}</div>
            {#each paths as p}
              <label class="conflict-option">
                <input type="radio" name="kind-{kind}" value={p} bind:group={picks[kind]} />
                <span class="conflict-name">{basename(p)}</span>
              </label>
            {/each}
          </div>
        {/each}
      </div>
      <div class="conflict-foot">
        <button class="btn-cancel" onclick={cancel}>Отмена</button>
        <button class="btn-apply" onclick={confirm}>OK</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .conflict-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6);
    display: flex; align-items: center; justify-content: center;
    z-index: 1100; padding: 20px;
  }
  .conflict-modal {
    background: var(--bg-1); border: 1px solid var(--border); border-radius: 8px;
    padding: 16px; min-width: 360px; max-width: 520px; max-height: 80vh;
    display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .conflict-head h3 {
    margin: 0 0 6px 0; font-size: 13px;
    text-transform: uppercase; letter-spacing: 0.06em; color: var(--fg-2);
  }
  .conflict-head p {
    margin: 0 0 12px 0; font-size: 12px; color: var(--fg-1);
  }
  .conflict-body {
    overflow-y: auto; max-height: 55vh; margin-bottom: 12px;
  }
  .conflict-group {
    margin-bottom: 14px; padding: 10px;
    background: var(--bg-2); border-radius: 6px;
  }
  .conflict-kind {
    font-size: 11px; color: var(--accent); font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;
  }
  .conflict-option {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: var(--fg-0); cursor: pointer;
    padding: 4px 0;
  }
  .conflict-option input { accent-color: var(--accent); }
  .conflict-name {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .conflict-foot {
    display: flex; gap: 8px; justify-content: flex-end;
    padding-top: 8px; border-top: 1px solid var(--border);
  }
  .btn-cancel, .btn-apply {
    padding: 6px 14px; border-radius: 4px;
    font-family: inherit; font-size: 12px; cursor: pointer;
    border: 1px solid var(--border);
  }
  .btn-cancel { background: var(--bg-2); color: var(--fg-1); }
  .btn-cancel:hover { border-color: var(--accent); }
  .btn-apply { background: var(--accent); color: var(--bg-0); border-color: var(--accent); }
  .btn-apply:hover { opacity: 0.9; }
</style>