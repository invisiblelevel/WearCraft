<script>
  let {
    left = '',
    right = '',
    leftActive = false,
    onleft = () => {},
    onright = () => {},
  } = $props();
</script>

<div class="mode-switch">
  <button type="button" class:active={leftActive} onclick={onleft}>{left}</button>
  <button type="button" class:active={!leftActive} onclick={onright}>{right}</button>
</div>

<style>
  :global(.mode-switch) {
    display: flex;
    gap: 0;
    margin-bottom: 14px;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }
  :global(.mode-switch button) {
    flex: 1;
    background: var(--bg-2);
    border: none;
    color: var(--fg-1);
    padding: 8px 10px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.15s;
  }
  :global(.mode-switch button:hover) {
    color: var(--accent);
  }
  :global(.mode-switch button.active) {
    background: var(--accent);
    color: #141414;
  }
  :global(.mode-switch button + button) {
    border-left: 1px solid var(--border);
  }
</style>