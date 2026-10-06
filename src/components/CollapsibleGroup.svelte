<script>
  import { ChevronDown } from '@lucide/svelte';

  let {
    title = '',
    open = $bindable(false),
    onopenchange = null,
    headerAction = null,
    children = null,
  } = $props();

  function toggle() {
    open = !open;
    onopenchange?.(open);
  }
</script>

<div class="collapsible">
  <button type="button" class="col-head" onclick={toggle}>
    <span class="col-chev" class:open>
      <ChevronDown size={12} />
    </span>
    <span class="col-title">{title}</span>
    {#if headerAction}
      <span
        class="col-action"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {@render headerAction()}
      </span>
    {/if}
  </button>

  {#if open}
    <div class="col-body">
      {#if children}{@render children()}{/if}
    </div>
  {/if}
</div>

<style>
  .collapsible {
    margin-bottom: 14px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg-1);
    overflow: hidden;
  }

  .col-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-2);
    border: none;
    color: var(--fg-1);
    padding: 8px 10px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    text-align: left;
    transition: color 0.12s, background 0.12s;
  }
  .col-head:hover {
    color: var(--accent);
    background: var(--bg-3);
  }

  .col-chev {
    display: flex;
    align-items: center;
    color: var(--fg-2);
    transition: transform 0.15s;
    flex-shrink: 0;
  }
  .col-chev.open {
    transform: rotate(0deg);
  }
  .col-chev:not(.open) {
    transform: rotate(-90deg);
  }

  .col-title {
    flex: 1;
    color: inherit;
  }

  .col-action {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .col-body {
    padding: 12px 10px 10px 10px;
    background: var(--bg-1);
  }
</style>