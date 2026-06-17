export interface RenderPreviewHtmlInput {
  jsFileName: string;
  jsSource: string;
  tagName: string;
  title?: string;
}

export function renderPreviewHtml(input: RenderPreviewHtmlInput): string {
  const title = escapeHtml(input.title?.trim() || "Banderdash export preview");
  const jsFileName = escapeHtml(input.jsFileName);
  const jsSource = escapeScript(input.jsSource);
  const tagName = escapeHtml(input.tagName);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>
    <script data-banderdash-source="${jsFileName}">
${jsSource}
    </script>
    <${tagName}></${tagName}>
  </body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeScript(value: string): string {
  return value.replaceAll("</script", "<\\/script");
}
