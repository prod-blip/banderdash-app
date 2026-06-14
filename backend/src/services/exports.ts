import { buildExport, type BuildExportResult } from "@banderdash/bundler";
import type { ArticleDoc } from "@banderdash/doc-model";
import type { LibraryBuildUnit } from "../nodes/builder.js";
import type { StaticValidationRecord } from "../nodes/staticValidator.js";
import type { BanderdashDatabase } from "./db.js";
import { evaluatePreviewExportEligibility, type SandboxQARecord } from "./qaResults.js";

export interface CreateExportRecordOptions {
  article: ArticleDoc;
  buildUnits: LibraryBuildUnit[];
  componentLibraryVersion: string;
  createId?: () => string;
  db: BanderdashDatabase;
  now?: () => Date;
  outputDir: string;
  qaOverrideConfirmed?: boolean;
  qaRecords: SandboxQARecord[];
  validationRecords: StaticValidationRecord[];
}

export interface ExportRecord {
  id: string;
  articleId: string;
  documentVersion: number;
  manifest: BuildExportResult["manifest"];
  payload: {
    artifacts: BuildExportResult["artifacts"];
    exportDir: string;
    tagName: string;
  };
  createdAt: string;
}

export class ExportEligibilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportEligibilityError";
  }
}

export async function createExportRecord(options: CreateExportRecordOptions): Promise<ExportRecord> {
  validateCurrentVersionInputs(options);
  const eligibility = evaluatePreviewExportEligibility({
    qaOverrideConfirmed: options.qaOverrideConfirmed,
    qaRecords: options.qaRecords,
    validationRecords: options.validationRecords
  });

  if (!eligibility.exportAllowed) {
    throw new ExportEligibilityError([...eligibility.hardBlocks, ...eligibility.warnings].join(" ") || "Export is not allowed.");
  }

  const createdAt = options.now?.() ?? new Date();
  const exportId = options.createId?.() ?? `export_${crypto.randomUUID()}`;
  const buildResult = await buildExport({
    article: {
      blocks: options.article.blocks.map((block) => ({ id: block.id, text: block.text, type: block.type })),
      id: options.article.id,
      title: firstHeadingText(options.article),
      version: options.article.version
    },
    componentLibraryVersion: options.componentLibraryVersion,
    createdAt,
    exportId,
    interactions: options.buildUnits.map((unit) => ({
      blockIds: blockIdsFromUnit(unit),
      componentName: unit.componentName,
      fallbackText: unit.fallbackText,
      id: unit.candidateId,
      mode: unit.mode
    })),
    outputDir: options.outputDir
  });

  const record: ExportRecord = {
    id: exportId,
    articleId: options.article.id,
    createdAt: createdAt.toISOString(),
    documentVersion: options.article.version,
    manifest: buildResult.manifest,
    payload: {
      artifacts: buildResult.artifacts,
      exportDir: buildResult.exportDir,
      tagName: buildResult.tagName
    }
  };

  persistExportRecord(options.db, record);
  return record;
}

export function getExportRecord(db: BanderdashDatabase, exportId: string): ExportRecord | null {
  const row = db
    .prepare("select id, article_id, document_version, manifest_json, payload_json, created_at from exports where id = ?")
    .get(exportId) as ExportRow | undefined;

  return row ? rowToExportRecord(row) : null;
}

function validateCurrentVersionInputs(options: CreateExportRecordOptions): void {
  const wrongBuildUnit = options.buildUnits.find((unit) => unit.articleId !== options.article.id || unit.documentVersion !== options.article.version);
  if (wrongBuildUnit) {
    throw new ExportEligibilityError(`Build unit ${wrongBuildUnit.id} does not match the current article version.`);
  }

  const wrongValidation = options.validationRecords.find(
    (record) => record.articleId !== options.article.id || record.documentVersion !== options.article.version
  );
  if (wrongValidation) {
    throw new ExportEligibilityError(`Validation result ${wrongValidation.id} does not match the current article version.`);
  }

  const wrongQA = options.qaRecords.find((record) => record.articleId !== options.article.id || record.documentVersion !== options.article.version);
  if (wrongQA) {
    throw new ExportEligibilityError(`QA result ${wrongQA.id} does not match the current article version.`);
  }
}

function persistExportRecord(db: BanderdashDatabase, record: ExportRecord): void {
  db.prepare(
    `insert into exports (id, article_id, document_version, manifest_json, payload_json, created_at)
      values (?, ?, ?, ?, ?, ?)`
  ).run(record.id, record.articleId, record.documentVersion, JSON.stringify(record.manifest), JSON.stringify(record.payload), record.createdAt);
}

function rowToExportRecord(row: ExportRow): ExportRecord {
  return {
    id: row.id,
    articleId: row.article_id,
    createdAt: row.created_at,
    documentVersion: row.document_version,
    manifest: JSON.parse(row.manifest_json),
    payload: JSON.parse(row.payload_json)
  };
}

function blockIdsFromUnit(unit: LibraryBuildUnit): string[] {
  const candidateBlockIds = unit.embeddedData.blockIds;
  return Array.isArray(candidateBlockIds) && candidateBlockIds.every((blockId) => typeof blockId === "string")
    ? candidateBlockIds
    : [unit.candidateId];
}

function firstHeadingText(article: ArticleDoc): string | undefined {
  return article.blocks.find((block) => block.type === "heading")?.text;
}

interface ExportRow {
  article_id: string;
  created_at: string;
  document_version: number;
  id: string;
  manifest_json: string;
  payload_json: string;
}
