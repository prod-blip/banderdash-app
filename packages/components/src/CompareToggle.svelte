<script lang="ts">
  import type { CompareToggleOption, CompareToggleProps } from "./compareToggle.schema.js";

  export let props: CompareToggleProps;

  let selected: "a" | "b" = "a";

  $: activeOption = selected === "a" ? props.optionA : props.optionB;

  function selectOption(option: CompareToggleOption) {
    selected = option.id;
  }
</script>

<section class="compare-toggle" aria-labelledby="compare-toggle-label">
  <div class="compare-toggle__intro">
    <h3 id="compare-toggle-label">{props.label}</h3>
    {#if props.description}
      <p>{props.description}</p>
    {/if}
    <p class="compare-toggle__fallback">{props.fallbackText}</p>
  </div>

  <div class="compare-toggle__controls" role="group" aria-label="Choose comparison state">
    <button type="button" class:active={selected === "a"} aria-pressed={selected === "a"} onclick={() => selectOption(props.optionA)}>
      {props.optionA.label}
    </button>
    <button type="button" class:active={selected === "b"} aria-pressed={selected === "b"} onclick={() => selectOption(props.optionB)}>
      {props.optionB.label}
    </button>
  </div>

  <article class="compare-toggle__panel" aria-live="polite">
    <p class="compare-toggle__eyebrow">{activeOption.label}</p>
    <h4>{activeOption.heading}</h4>
    <p>{activeOption.body}</p>
  </article>
</section>

<style>
  .compare-toggle {
    border: 1px solid currentColor;
    border-radius: 0.75rem;
    display: grid;
    gap: 1rem;
    padding: 1rem;
  }

  .compare-toggle__intro h3,
  .compare-toggle__intro p,
  .compare-toggle__panel h4,
  .compare-toggle__panel p {
    margin: 0 0 0.5rem;
  }

  .compare-toggle__fallback {
    opacity: 0.8;
  }

  .compare-toggle__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .compare-toggle__controls button {
    border: 1px solid currentColor;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding: 0.5rem 0.85rem;
  }

  .compare-toggle__controls button:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: 2px;
  }

  .compare-toggle__controls button.active {
    background: currentColor;
  }

  .compare-toggle__panel {
    border-radius: 0.5rem;
    background: rgba(0, 0, 0, 0.04);
    padding: 1rem;
  }

  .compare-toggle__eyebrow {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
