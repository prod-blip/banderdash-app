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
    mode: interaction.mode
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
    "    const blocks = article.blocks.map((block) => `<p data-block-id=\"${escapeHtml(block.id)}\">${escapeHtml(block.text)}</p>`).join('\\n');",
    "    const interactionFallbacks = interactions.map((interaction) => `<section data-interaction-id=\"${escapeHtml(interaction.id)}\"><p>${escapeHtml(interaction.fallbackText)}</p></section>`).join('\\n');",
    "    root.innerHTML = `<article><h1>${escapeHtml(article.title || 'Interactive Article')}</h1>${blocks}${interactionFallbacks}</article>`;",
    "  }",
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
