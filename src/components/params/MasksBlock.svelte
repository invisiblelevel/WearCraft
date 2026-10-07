<script>
  import { Plus, X, Library } from '@lucide/svelte';
  import { t } from '../../i18n.svelte.js';
  import {
    getUserMask, getUserMaskBasename, pickUserMask, clearUserMask, getFolderMaskNames,
  } from '../../lib/stores.svelte.js';
  import { openMasksLibrary } from '../../lib/params-helpers.js';

  let { preset } = $props();
</script>

<div class="masks-block">
  {#if getUserMask(preset)}
    <div class="user-mask-row">
      <span class="user-mask-name" title={getUserMask(preset)}>{getUserMaskBasename(preset)}</span>
      <button type="button" class="user-mask-clear" onclick={() => clearUserMask(preset)} title="Очистить">
        <X size={12} />
      </button>
    </div>
    <div class="user-mask-hint">{t('mask.user_only_hint')}</div>
  {:else}
    <button type="button" class="mask-action-btn" onclick={() => pickUserMask(preset)}>
      <Plus size={14} />
      {t('mask.add_user')}
    </button>
    <button type="button" class="mask-action-btn library" onclick={() => openMasksLibrary(preset)}>
      <Library size={14} />
      {t('mask.library')}
      <span class="library-count">({getFolderMaskNames(preset).length})</span>
    </button>
  {/if}
</div>

<style>
  :global(.masks-block) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 14px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border);
  }
</style>