import type { BanderdashDatabase } from "./db.js";
import type { StaticValidationRecord } from "../nodes/staticValidator.js";

export type SandboxQAStatus = "passed" | "warning" | "crashed";

export type SandboxQAFindingSeverity = "warning" | "crash";

export interface SandboxQAFinding {
  code: string;
  message: string;
  severity: SandboxQAFindingSeverity;
}

export interface SandboxQAResult {
  ok: boolean;
  findings: SandboxQAFinding[];
}

export interface SandboxQARecord {
  id: string;
  generatedSpecId: string;
  articleId: string;
  documentVersion: number;
  status: SandboxQAStatus;
  result: SandboxQAResult;
}

export interface PersistQAResultsOptions {
  db: BanderdashDatabase;
  records: SandboxQARecord[];
  now?: Date;
}

export interface PreviewExportEligibility {
  previewAllowed: boolean;
  exportAllowed: boolean;
  requiresExplicitQAConfirmation: boolean;
  hardBlocks: string[];
  warnings: string[];
}

export interface EvaluatePreviewExportEligibilityOptions {
  validationRecords: StaticValidationRecord[];
  qaRecords: SandboxQARecord[];
  qaOverrideConfirmed?: boolean;
}

export function createSandboxQAResult(findings: SandboxQAFinding[]): SandboxQAResult {
  return {
    ok: findings.every((finding) => finding.severity !== "crash"),
    findings
  };
}

export function statusFromQAResult(result: SandboxQAResult): SandboxQAStatus {
  if (result.findings.some((finding) => finding.severity === "crash")) {
    return "crashed";
  }

  if (result.findings.length > 0) {
    return "warning";
  }

  return "passed";
}

export function persistQAResults(options: PersistQAResultsOptions): void {
  const timestamp = (options.now ?? new Date()).toISOString();
  const statement = options.db.prepare(
    `insert into qa_results (id, generated_spec_id, article_id, document_version, status, payload_json, created_at)
      values (?, ?, ?, ?, ?, ?, ?)`
  );

  options.db.exec("BEGIN;");
  try {
    for (const record of options.records) {
      statement.run(
        record.id,
        record.generatedSpecId,
        record.articleId,
        record.documentVersion,
        record.status,
        JSON.stringify(record.result),
        timestamp
      );
    }
    options.db.exec("COMMIT;");
  } catch (error) {
    options.db.exec("ROLLBACK;");
    throw error;
  }
}

export function evaluatePreviewExportEligibility(options: EvaluatePreviewExportEligibilityOptions): PreviewExportEligibility {
  const hardBlocks = options.validationRecords
    .filter((record) => record.status === "failed")
    .map((record) => `Static validation failed for ${record.generatedSpecId}.`);
  const qaWarnings = options.qaRecords
    .filter((record) => record.status === "warning" || record.status === "crashed")
    .flatMap((record) =>
      record.result.findings.map((finding) => `${record.generatedSpecId}: ${finding.message}`)
    );
  const requiresExplicitQAConfirmation = hardBlocks.length === 0 && qaWarnings.length > 0 && !options.qaOverrideConfirmed;

  return {
    previewAllowed: hardBlocks.length === 0,
    exportAllowed: hardBlocks.length === 0 && !requiresExplicitQAConfirmation,
    requiresExplicitQAConfirmation,
    hardBlocks,
    warnings: qaWarnings
  };
}
