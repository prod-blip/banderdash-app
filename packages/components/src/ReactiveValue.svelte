<script lang="ts">
  import { computeReactiveValue, type ReactiveValueProps } from "./reactiveValue.schema.js";

  export let props: ReactiveValueProps;

  let currentValue = props.initialValue;

  $: currentValue = Math.min(props.max, Math.max(props.min, currentValue));
  $: resultValue = computeReactiveValue(props, currentValue);
  $: formattedInput = `${currentValue}${props.unit ? ` ${props.unit}` : ""}`;
  $: formattedResult = `${resultValue}${props.unit ? ` ${props.unit}` : ""}`;
</script>

<section class="reactive-value" aria-labelledby="reactive-value-label">
  <div class="reactive-value__content">
    <h3 id="reactive-value-label">{props.label}</h3>
    {#if props.description}
      <p>{props.description}</p>
    {/if}
    <p class="reactive-value__fallback">{props.fallbackText}</p>
  </div>

  <label class="reactive-value__control">
    <span>Adjust value: {formattedInput}</span>
    <input
      type="range"
      min={props.min}
      max={props.max}
      step={props.step}
      bind:value={currentValue}
      aria-describedby="reactive-value-result"
    />
  </label>

  <output id="reactive-value-result" class="reactive-value__result" aria-live="polite">
    {props.resultLabel}: {formattedResult}
  </output>
</section>

<style>
  .reactive-value {
    border: 1px solid currentColor;
    border-radius: 0.75rem;
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }

  .reactive-value__content h3,
  .reactive-value__content p {
    margin: 0 0 0.5rem;
  }

  .reactive-value__fallback {
    opacity: 0.8;
  }

  .reactive-value__control {
    display: grid;
    gap: 0.5rem;
  }

  .reactive-value__control input {
    width: 100%;
  }

  .reactive-value__result {
    font-weight: 700;
  }
</style>
