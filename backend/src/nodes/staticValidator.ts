import { createValidationResult, validateRestrictedSubset, type ValidationResult } from "@banderdash/validators";
import type { BanderdashDatabase } from "../services/db.js";
import type { LibraryBuildUnit } from "./builder.js";

export interface StaticValidatorNodeOptions {
  buildUnits: LibraryBuildUnit[];
  componentSourceByPath: Record<string, string>;
  db: BanderdashDatabase;
  now?: () => Date;
}

export interface StaticValidationRecord {
  id: string;
  generatedSpecId: string;
  articleId: string;
  documentVersion: number;
  status: "passed" | "failed";
  result: ValidationResult;
}

export function runStaticValidatorNode(options: StaticValidatorNodeOptions): StaticValidationRecord[] {
  const now = options.now?.() ?? new Date();
  const records = options.buildUnits.map((unit) => validateBuildUnit(unit, options.componentSourceByPath));
  persistValidationRecords(options.db, records, now);
  return records;
}

function validateBuildUnit(unit: LibraryBuildUnit, componentSourceByPath: Record<string, string>): StaticValidationRecord {
  const source = componentSourceByPath[unit.componentPath];
  const result = source
    ? validateRestrictedSubset({ source })
    : createValidationResult({
        hardFailures: [
          {
            code: "MISSING_COMPONENT_SOURCE",
            message: `No component source was provided for ${unit.componentPath}.`
          }
        ]
      });

  return {
    id: `validation_${unit.specId}`,
    generatedSpecId: unit.specId,
    articleId: unit.articleId,
    documentVersion: unit.documentVersion,
    status: result.ok ? "passed" : "failed",
    result
  };
}

function persistValidationRecords(db: BanderdashDatabase, records: StaticValidationRecord[], now: Date): void {
  const timestamp = now.toISOString();
  const statement = db.prepare(
    `insert into validation_results (id, generated_spec_id, article_id, document_version, status, payload_json, created_at)
      values (?, ?, ?, ?, ?, ?, ?)`
  );

  db.exec("BEGIN;");
  try {
    for (const record of records) {
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
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}
