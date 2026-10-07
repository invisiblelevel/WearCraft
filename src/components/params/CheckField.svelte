<script>
  let {
    label = '',
    checked = $bindable(false),
    variant = 'normal',  // 'normal' | 'edge' | 'edge-active'
    disabled = false,
  } = $props();
</script>

<label
  class="check"
  class:normal-check={variant === 'normal'}
  class:edge-mode={variant === 'edge' || variant === 'edge-active'}
  class:active={variant === 'edge-active'}
>
  <input type="checkbox" bind:checked {disabled} />
  {label}
</label>

<style>
  :global(.check) {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--fg-1);
    cursor: pointer;
    margin-bottom: 8px;
  }
  :global(.check input) {
    accent-color: var(--accent);
  }
  :global(.check.normal-check) {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    color: var(--fg-0);
  }
  :global(.check.edge-mode) {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--border);
    color: var(--fg-2);
  }
  :global(.check.edge-mode.active) {
    color: var(--accent);
  }
</style>