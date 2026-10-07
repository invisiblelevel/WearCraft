<script>
  import ColorPicker from '../ColorPicker.svelte';
  import { rgbToCss, rgbToHex } from '../../lib/params-helpers.js';

  let {
    label = '',
    color = $bindable([95, 85, 75]),
    pickerOpen = $bindable(false),
  } = $props();

  function toggle() { pickerOpen = !pickerOpen; }
  function close()  { pickerOpen = false; }
</script>

<div class="field">
  <span>{label}</span>
  <button type="button" class="color-btn" onclick={toggle}>
    <span class="color-swatch" style="background: {rgbToCss(color)}"></span>
    <span class="color-hex">{rgbToHex(color)}</span>
  </button>
  {#if pickerOpen}
    <div class="color-popover">
      <ColorPicker
        rgb={{ r: color[0], g: color[1], b: color[2] }}
        onchange={(c) => { color = [c.r, c.g, c.b]; }}
        onapply={close}
        oncancel={close}
      />
    </div>
  {/if}
</div>

<style>
  :global(.color-btn) {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-2);
    border: 1px solid var(--border);
    color: var(--fg-0);
    padding: 6px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
  }
  :global(.color-btn:hover) {
    border-color: var(--accent);
  }
  :global(.color-swatch) {
    width: 20px;
    height: 20px;
    border-radius: 3px;
    border: 1px solid var(--border);
    flex-shrink: 0;
  }
  :global(.color-hex) {
    color: var(--fg-1);
    font-family: monospace;
    font-size: 11px;
  }
  :global(.color-popover) {
    margin-top: 8px;
    padding: 12px;
    background: var(--bg-1);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    position: relative;
    z-index: 5;
  }
</style>