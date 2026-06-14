import type { ArticleDoc } from "@banderdash/doc-model";
import type { LibraryBuildUnit } from "./builder.js";
import type { StaticValidationRecord } from "./staticValidator.js";
import { createExportRecord, type ExportRecord } from "../services/exports.js";
import type { SandboxQARecord } from "../services/qaResults.js";
import type { BanderdashDatabase } from "../services/db.js";

export interface ExportNodeOptions {
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

export async function runExportNode(options: ExportNodeOptions): Promise<ExportRecord> {
  return createExportRecord(options);
}
