import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createExportManifest } from "./manifest.js";
import { renderPreviewHtml } from "./previewHtml.js";
import { generateExportTagName } from "./tagName.js";
import type { ExportManifest, ExportManifestFile, ExportManifestInteraction } from "./types.js";

export interface ExportArticleBlock {
  id: string;
  text: string;
  type: string;
}

export interface ExportInteractionInput {
  blockIds: string[];
  componentName?: string;
  fallbackText: string;
  id: string;
  mode: "library" | "restricted-bespoke";
  props?: Record<string, unknown>;
}

export interface BuildExportInput {
  article: {
    blocks: ExportArticleBlock[];
    id: string;
    title?: string;
    version: number;
  };
  componentLibraryVersion: string;
  createdAt?: Date;
  exportId: string;
  interactions: ExportInteractionInput[];
  outputDir: string;
}

export interface ExportArtifactFile extends ExportManifestFile {
  absolutePath: string;
}

export interface BuildExportResult {
  artifacts: ExportArtifactFile[];
  exportDir: string;
  manifest: ExportManifest;
  tagName: string;
}

export async function buildExport(input: BuildExportInput): Promise<BuildExportResult> {
  const tagName = generateExportTagName({ exportId: input.exportId });
  const exportDir = join(input.outputDir, input.exportId);
  await mkdir(exportDir, { recursive: false });

  const jsFileName = `${tagName}.js`;
  const previewFileName = "preview.html";
  const manifestFileName = "manifest.json";

  const jsSource = renderExportJavaScript({ article: input.article, interactions: input.interactions, tagName });
  await writeFile(join(exportDir, jsFileName), jsSource, { encoding: "utf8", flag: "wx" });

  const previewHtml = renderPreviewHtml({ jsFileName, jsSource, tagName, title: input.article.title });
  await writeFile(join(exportDir, previewFileName), previewHtml, { encoding: "utf8", flag: "wx" });

  const exportedFiles = [
    await describeFile(exportDir, jsFileName, jsSource),
    await describeFile(exportDir, previewFileName, previewHtml)
  ];

  const manifest = createExportManifest({
    articleId: input.article.id,
    componentLibraryVersion: input.componentLibraryVersion,
    createdAt: input.createdAt ?? new Date(),
    documentVersion: input.article.version,
    exportId: input.exportId,
    files: exportedFiles.map(({ absolutePath: _absolutePath, ...file }) => file),
    interactions: input.interactions.map(toManifestInteraction),
    tagName
  });

  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(join(exportDir, manifestFileName), manifestJson, { encoding: "utf8", flag: "wx" });

  const manifestFile = await describeFile(exportDir, manifestFileName, manifestJson);
  return { artifacts: [...exportedFiles, manifestFile], exportDir, manifest, tagName };
}

function renderExportJavaScript(input: { article: BuildExportInput["article"]; interactions: ExportInteractionInput[]; tagName: string }): string {
  const articleBlocks = input.article.blocks.map((block) => ({ id: block.id, text: block.text, type: block.type }));
  const interactions = input.interactions.map((interaction) => ({
    blockIds: interaction.blockIds,
    componentName: interaction.componentName,
    fallbackText: interaction.fallbackText,
    id: interaction.id,
    mode: interaction.mode,
    props: interaction.props ?? {}
  }));

  return [
    `const article = ${JSON.stringify({ blocks: articleBlocks, title: input.article.title ?? "" })};`,
    `const interactions = ${JSON.stringify(interactions)};`,
    "",
    "function escapeHtml(value) {",
    "  return String(value)",
    "    .replaceAll('&', '&amp;')",
    "    .replaceAll('<', '&lt;')",
    "    .replaceAll('>', '&gt;')",
    "    .replaceAll('\\\"', '&quot;');",
    "}",
    "",
    "class BanderdashArticleExport extends HTMLElement {",
    "  connectedCallback() {",
    "    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });",
    "    const blocks = article.blocks.map((block, index) => renderBlock(block, index)).filter(Boolean).join('\\n');",
    "    const interactionMarkup = interactions.map(renderInteraction).join('\\n');",
    "    const title = article.title ? `<h1>${escapeHtml(article.title)}</h1>` : '';",
    "    root.innerHTML = `<style>${styles()}</style><article>${title}${blocks}${interactionMarkup}</article>`;",
    "    hydrateReactiveValues(root);",
    "    hydrateCompareToggles(root);",
    "  }",
    "}",
    "",
    "function renderBlock(block, index) {",
    "  if (block.type === 'heading') {",
    "    if (index === 0 && article.title && block.text.trim() === article.title.trim()) {",
    "      return '';",
    "    }",
    "    return `<h2 data-block-id=\"${escapeHtml(block.id)}\">${escapeHtml(block.text)}</h2>`;",
    "  }",
    "  if (block.type === 'quote') {",
    "    return `<blockquote data-block-id=\"${escapeHtml(block.id)}\">${escapeHtml(block.text)}</blockquote>`;",
    "  }",
    "  return `<p data-block-id=\"${escapeHtml(block.id)}\">${escapeHtml(block.text)}</p>`;",
    "}",
    "",
    "function renderInteraction(interaction) {",
    "  if (interaction.componentName === 'ReactiveValue') {",
    "    return renderReactiveValue(interaction);",
    "  }",
    "  if (interaction.componentName === 'CompareToggle') {",
    "    return renderCompareToggle(interaction);",
    "  }",
    "  return `<section class=\"ia-interaction\" data-interaction-id=\"${escapeHtml(interaction.id)}\"><p>${escapeHtml(interaction.fallbackText)}</p></section>`;",
    "}",
    "",
    "function renderReactiveValue(interaction) {",
    "  const props = interaction.props || {};",
    "  const value = Number.isFinite(props.initialValue) ? props.initialValue : 0;",
    "  const min = Number.isFinite(props.min) ? props.min : 0;",
    "  const max = Number.isFinite(props.max) ? props.max : Math.max(value, 10);",
    "  const step = Number.isFinite(props.step) && props.step > 0 ? props.step : 1;",
    "  const label = props.label || 'Explore value';",
    "  const resultLabel = props.resultLabel || 'Result';",
    "  return `<section class=\"ia-interaction ia-reactive-value\" data-interaction-id=\"${escapeHtml(interaction.id)}\">",
    "    <h3>${escapeHtml(label)}</h3>",
    "    ${props.description ? `<p>${escapeHtml(props.description)}</p>` : ''}",
    "    <p>${escapeHtml(props.fallbackText || interaction.fallbackText)}</p>",
    "    <label><span>Adjust value: <strong data-current>${escapeHtml(formatValue(value, props.unit))}</strong></span><input type=\"range\" min=\"${escapeHtml(min)}\" max=\"${escapeHtml(max)}\" step=\"${escapeHtml(step)}\" value=\"${escapeHtml(value)}\" /></label>",
    "    <output aria-live=\"polite\" data-result>${escapeHtml(resultLabel)}: ${escapeHtml(formatValue(computeReactiveValue(props, value), props.unit))}</output>",
    "  </section>`;",
    "}",
    "",
    "function renderCompareToggle(interaction) {",
    "  const props = interaction.props || {};",
    "  const optionA = props.optionA || { id: 'a', label: 'A', heading: 'Option A', body: 'First side of the comparison.' };",
    "  const optionB = props.optionB || { id: 'b', label: 'B', heading: 'Option B', body: 'Second side of the comparison.' };",
    "  return `<section class=\"ia-interaction ia-compare-toggle\" data-interaction-id=\"${escapeHtml(interaction.id)}\">",
    "    <h3>${escapeHtml(props.label || 'Compare alternatives')}</h3>",
    "    ${props.description ? `<p>${escapeHtml(props.description)}</p>` : ''}",
    "    <p>${escapeHtml(props.fallbackText || interaction.fallbackText)}</p>",
    "    <div class=\"ia-toggle-controls\" role=\"group\" aria-label=\"Choose comparison state\"><button type=\"button\" data-option=\"a\" aria-pressed=\"true\">${escapeHtml(optionA.label)}</button><button type=\"button\" data-option=\"b\" aria-pressed=\"false\">${escapeHtml(optionB.label)}</button></div>",
    "    <article class=\"ia-compare-panel\" aria-live=\"polite\" data-panel data-option-a=\"${escapeHtml(JSON.stringify(optionA))}\" data-option-b=\"${escapeHtml(JSON.stringify(optionB))}\"></article>",
    "  </section>`;",
    "}",
    "",
    "function hydrateReactiveValues(root) {",
    "  root.querySelectorAll('.ia-reactive-value').forEach((section) => {",
    "    const interaction = interactions.find((item) => item.id === section.dataset.interactionId);",
    "    if (!interaction) return;",
    "    const props = interaction.props || {};",
    "    const input = section.querySelector('input');",
    "    const current = section.querySelector('[data-current]');",
    "    const result = section.querySelector('[data-result]');",
    "    const update = () => {",
    "      const value = Number(input.value);",
    "      current.textContent = formatValue(value, props.unit);",
    "      result.textContent = `${props.resultLabel || 'Result'}: ${formatValue(computeReactiveValue(props, value), props.unit)}`;",
    "    };",
    "    input.addEventListener('input', update);",
    "    update();",
    "  });",
    "}",
    "",
    "function hydrateCompareToggles(root) {",
    "  root.querySelectorAll('.ia-compare-toggle').forEach((section) => {",
    "    const panel = section.querySelector('[data-panel]');",
    "    const options = { a: JSON.parse(panel.dataset.optionA), b: JSON.parse(panel.dataset.optionB) };",
    "    const render = (selected) => {",
    "      const option = options[selected];",
    "      panel.innerHTML = `<p class=\"ia-eyebrow\">${escapeHtml(option.label)}</p><h4>${escapeHtml(option.heading)}</h4><p>${escapeHtml(option.body)}</p>`;",
    "      section.querySelectorAll('button[data-option]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.option === selected)));",
    "    };",
    "    section.querySelectorAll('button[data-option]').forEach((button) => button.addEventListener('click', () => render(button.dataset.option)));",
    "    render('a');",
    "  });",
    "}",
    "",
    "function computeReactiveValue(props, currentValue) {",
    "  const calculation = props.calculation || {};",
    "  const operand = Number.isFinite(calculation.operand) ? calculation.operand : 0;",
    "  const raw = calculation.operation === 'add' ? currentValue + operand : currentValue * operand;",
    "  const precision = Number.isInteger(calculation.precision) ? calculation.precision : 2;",
    "  return Number(raw.toFixed(precision));",
    "}",
    "",
    "function formatValue(value, unit) {",
    "  return `${value}${unit ? ` ${unit}` : ''}`;",
    "}",
    "",
    "function styles() {",
    "  return '.ia-interaction{border:1px solid currentColor;border-radius:.75rem;margin:1rem 0;padding:1rem}.ia-reactive-value label{display:grid;gap:.5rem}.ia-reactive-value input{width:100%}.ia-toggle-controls{display:flex;gap:.5rem;flex-wrap:wrap}.ia-toggle-controls button{border:1px solid currentColor;border-radius:999px;background:transparent;color:inherit;cursor:pointer;font:inherit;padding:.5rem .85rem}.ia-toggle-controls button[aria-pressed=\"true\"]{background:currentColor;color:white}.ia-compare-panel{background:rgba(0,0,0,.04);border-radius:.5rem;margin-top:1rem;padding:1rem}.ia-eyebrow{font-size:.8rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}';",
    "}",
    "",
    `customElements.define(${JSON.stringify(input.tagName)}, BanderdashArticleExport);`,
    ""
  ].join("\n");
}

async function describeFile(exportDir: string, path: string, content: string): Promise<ExportArtifactFile> {
  return {
    absolutePath: join(exportDir, path),
    bytes: Buffer.byteLength(content, "utf8"),
    path,
    sha256: createHash("sha256").update(content).digest("hex")
  };
}

function toManifestInteraction(interaction: ExportInteractionInput): ExportManifestInteraction {
  return {
    blockIds: interaction.blockIds,
    componentName: interaction.componentName,
    id: interaction.id,
    mode: interaction.mode
  };
}
