<script>
  let {
    label = '',
    value = $bindable(0),
    min = 0,
    max = 1,
    step = 0.01,
    format = (v) => v.toFixed(2),
    disabled = false,
    hint = '',
  } = $props();
</script>

<label class="field" class:disabled>
  <span>{label} <em>{format(value)}</em></span>
  <input type="range" {min} {max} {step} bind:value {disabled} />
  {#if hint}<small>{hint}</small>{/if}
</label>

<style>
  :global(.field) {
    display: block;
    margin-bottom: 10px;
  }
  :global(.field > span) {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: var(--fg-1);
    margin-bottom: 4px;
  }
  :global(.field > span em) {
    color: var(--accent);
    font-style: normal;
    font-weight: 600;
  }
  :global(.field small) {
    display: block;
    color: var(--fg-2);
    font-size: 10px;
    margin-top: 3px;
  }
  :global(.field input[type="range"]) {
    width: 100%;
    accent-color: var(--accent);
  }
  :global(.field.disabled) {
    opacity: 0.4;
    pointer-events: none;
  }
</style>