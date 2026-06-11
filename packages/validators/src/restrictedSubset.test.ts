import { describe, expect, it } from "vitest";
import { validateRestrictedSubset } from "./restrictedSubset.js";

const safeSvelteSource = `<script lang="ts">
  import { computeReactiveValue } from "./reactiveValue.schema.js";
  export let props;
  $: resultValue = computeReactiveValue(props, props.initialValue);
</script>

<section aria-labelledby="label">
  <h3 id="label">{props.label}</h3>
  <p>{props.fallbackText}</p>
  <output aria-live="polite">{resultValue}</output>
</section>`;

describe("restricted subset validator", () => {
  it("allows the approved library component source subset", () => {
    expect(validateRestrictedSubset({ source: safeSvelteSource })).toEqual({ ok: true, hardFailures: [], warnings: [] });
  });

  it.each([
    ["RUNTIME_NETWORK_FETCH", "fetch('/api/data')"],
    ["RUNTIME_NETWORK_XHR", "new XMLHttpRequest()"],
    ["RUNTIME_NETWORK_WEBSOCKET", "new WebSocket('ws://localhost')"],
    ["RUNTIME_NETWORK_EVENTSOURCE", "new EventSource('/events')"],
    ["STORAGE_LOCAL", "localStorage.setItem('x', 'y')"],
    ["STORAGE_SESSION", "sessionStorage.getItem('x')"],
    ["STORAGE_INDEXEDDB", "indexedDB.open('x')"],
    ["COOKIE_ACCESS", "document.cookie"],
    ["DYNAMIC_EVAL", "eval('2 + 2')"],
    ["DYNAMIC_FUNCTION", "new Function('return 1')"],
    ["DYNAMIC_IMPORT", "import('./late.js')"],
    ["RAW_HTML", "{@html unsafe}"],
    ["HOST_DOM_QUERY", "document.querySelector('.host')"],
    ["HOST_PARENT_WINDOW", "window.parent.postMessage({})"],
    ["REMOTE_URL", "const image = 'https://example.com/a.png'"],
    ["GLOBAL_EVENT_LISTENER", "window.addEventListener('resize', onResize)"],
    ["GLOBAL_TIMER", "setInterval(tick, 1000)"]
  ])("hard-blocks %s", (code, unsafeSource) => {
    const result = validateRestrictedSubset({ source: `<script>${unsafeSource}</script>` });

    expect(result.ok).toBe(false);
    expect(result.hardFailures).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
  });

  it("hard-blocks external static imports", () => {
    const result = validateRestrictedSubset({ source: `import confetti from "canvas-confetti";` });

    expect(result.ok).toBe(false);
    expect(result.hardFailures).toEqual([
      { code: "EXTERNAL_IMPORT", message: "External import 'canvas-confetti' is not allowed in exported components." }
    ]);
  });
});
