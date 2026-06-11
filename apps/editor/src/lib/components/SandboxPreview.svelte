<script lang="ts">
  export let rendererScriptSrc = "/sandbox/renderer.js";
  export let title = "Banderdash sandbox preview";

  const sandboxFlags = "allow-scripts";
  const csp = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'unsafe-inline'",
    "img-src 'none'",
    "connect-src 'none'",
    "font-src 'none'"
  ].join("; ");

  $: srcdoc = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>
    <div id="sandbox-root" aria-live="polite"></div>
    <script type="module" src="${rendererScriptSrc}"><\/script>
  </body>
</html>`;
</script>

<div class="sandbox-preview-shell">
  <iframe {title} {srcdoc} sandbox={sandboxFlags} referrerpolicy="no-referrer"></iframe>
</div>

<style>
  .sandbox-preview-shell {
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    border-radius: 0.75rem;
    overflow: hidden;
  }

  iframe {
    background: white;
    border: 0;
    display: block;
    min-height: 20rem;
    width: 100%;
  }
</style>
