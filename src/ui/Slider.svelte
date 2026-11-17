<script>
  let { label, value = $bindable(), min, max, step, format = (v) => v } = $props();
  const id = $props.id();
</script>

<div class="slider">
  <div class="head">
    <label for={id}>{label}</label>
    <output for={id} class="num">{format(value)}</output>
  </div>
  <input {id} type="range" {min} {max} {step} bind:value style="--fill: {((value - min) / (max - min)) * 100}%" />
</div>

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
  }

  label {
    color: var(--muted);
  }

  output {
    color: var(--ink);
    font-weight: 500;
  }

  input {
    width: 100%;
    height: 18px;
    margin: 0;
    background: transparent;
    appearance: none;
    cursor: pointer;
  }

  input::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--save) var(--fill), rgba(160, 200, 235, 0.18) var(--fill));
  }

  input::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--save) var(--fill), rgba(160, 200, 235, 0.18) var(--fill));
  }

  input::-webkit-slider-thumb {
    appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -5px;
    border-radius: 50%;
    background: var(--ink);
    border: 0;
    box-shadow: 0 0 0 4px rgba(79, 209, 181, 0.18);
  }

  input::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--ink);
    border: 0;
  }
</style>
