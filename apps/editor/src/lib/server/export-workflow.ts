import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { InteractionCandidate } from "@banderdash/backend/nodes/schemas/candidate";
import type { ComponentSpec } from "@banderdash/backend/nodes/schemas/componentSpec";
import { runLibraryBuilderNode } from "@banderdash/backend/nodes/builder";
import { runStaticValidatorNode } from "@banderdash/backend/nodes/staticValidator";
import { runSandboxQANode } from "@banderdash/backend/nodes/sandboxQA";
import { createExportRecord, ExportEligibilityError, type ExportRecord } from "@banderdash/backend/services/exports";
import { getEditorArticleService, getEditorDatabase } from "./article-service";

export interface LocalExportOptions {
  articleId: string;
  expectedVersion: number;
  qaOverrideConfirmed?: boolean;
}

export interface LocalExportResult {
  exportId: string;
  articleId: string;
  documentVersion: number;
  tagName: string;
  exportDir: string;
  files: Array<{ path: string; bytes: number; sha256: string }>;
  previewPath: string;
}

interface CandidateRow {
  id: string;
  payload_json: string;
}

export async function exportLocalArticle(options: LocalExportOptions): Promise<LocalExportResult> {
  if (!options.articleId.trim()) {
    throw new Error("articleId is required.");
  }
  if (!Number.isInteger(options.expectedVersion) || options.expectedVersion < 1) {
    throw new Error("expectedVersion must be a positive integer.");
  }

  const db = getEditorDatabase();
  const article = await getEditorArticleService().getArticle(options.articleId);
  if (article.version !== options.expectedVersion) {
    throw new Error(`Article ${article.id} is at version ${article.version}; reload before exporting version ${options.expectedVersion}.`);
  }

  const candidates = readApprovedCandidates(options.articleId, options.expectedVersion);
  if (candidates.length === 0) {
    throw new ExportEligibilityError("Approve at least one survived interaction candidate before exporting.");
  }

  const exportId = `export_${randomUUID()}`;
  const specs = candidates.map((candidate, index) =>
    createLocalComponentSpec(candidate, article.blocks.find((block) => candidate.blockIds.includes(block.id))?.text ?? "", exportId, index)
  );
  persistGeneratedSpecs(specs);
  const buildUnits = runLibraryBuilderNode({ specs });
  const componentSourceByPath = Object.fromEntries(
    [...new Set(buildUnits.map((unit) => unit.componentPath))].map((componentPath) => [componentPath, readComponentSource(componentPath)])
  );
  const validationRecords = runStaticValidatorNode({ buildUnits, componentSourceByPath, db });
  const qaRecords = runSandboxQANode({ buildUnits, componentSourceByPath, db });
  const outputDir = join(findProjectRoot(), ".banderdash", "exports");
  mkdirSync(outputDir, { recursive: true });
  const record = await createExportRecord({
    article,
    buildUnits,
    componentLibraryVersion: "0.1.0",
    createId: () => exportId,
    db,
    outputDir,
    qaOverrideConfirmed: options.qaOverrideConfirmed,
    qaRecords,
    validationRecords
  });

  return toLocalExportResult(record);
}

function persistGeneratedSpecs(specs: ComponentSpec[]): void {
  const db = getEditorDatabase();
  const now = new Date().toISOString();
  const statement = db.prepare(
    `insert into generated_specs (id, candidate_id, article_id, document_version, payload_json, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?)`
  );

  db.exec("BEGIN;");
  try {
    for (const spec of specs) {
      statement.run(spec.id, spec.candidateId, spec.articleId, spec.documentVersion, JSON.stringify(spec), now, now);
    }
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function readApprovedCandidates(articleId: string, documentVersion: number): InteractionCandidate[] {
  const rows = getEditorDatabase()
    .prepare(
      `select candidates.id, candidates.payload_json
        from candidates
        inner join approvals on approvals.candidate_id = candidates.id
        where candidates.article_id = ?
          and candidates.document_version = ?
          and candidates.status = 'survived'
          and candidates.invalidated_at is null
          and approvals.decision = 'approved'
          and approvals.invalidated_at is null`
    )
    .all(articleId, documentVersion) as unknown as CandidateRow[];

  return rows.map((row) => JSON.parse(row.payload_json) as InteractionCandidate);
}

function createLocalComponentSpec(candidate: InteractionCandidate, blockText: string, exportId: string, index: number): ComponentSpec {
  if (candidate.pattern === "compare_toggle") {
    return createCompareToggleSpec(candidate, blockText, exportId, index);
  }
  return createReactiveValueSpec(candidate, blockText, exportId, index);
}

function createReactiveValueSpec(candidate: InteractionCandidate, blockText: string, exportId: string, index: number): ComponentSpec {
  const numbers = [...blockText.matchAll(/-?\d+(?:\.\d+)?/gu)].map((match) => Number(match[0])).filter(Number.isFinite);
  const initialValue = numbers[0] ?? 1;
  const operand = numbers.length > 1 && numbers[0] !== 0 ? Number((numbers[1]! / numbers[0]!).toFixed(2)) : 2;
  const max = Math.max(initialValue * 2, initialValue + 10, 10);
  const fallbackText = `Interactive fallback for approved candidate ${candidate.id}: ${candidate.understandingLossIfRemoved}`;

  return {
    accessibilityNotes: "Labelled range input with live result output.",
    articleId: candidate.articleId,
    candidateId: candidate.id,
    componentName: "ReactiveValue",
    documentVersion: candidate.documentVersion,
    embeddedData: { blockIds: candidate.blockIds },
    fallbackText,
    id: `spec_${exportId}_${index + 1}`,
    mode: "library",
    props: {
      calculation: { operand, operation: "multiply", precision: 2 },
      fallbackText,
      initialValue,
      label: "Explore the article value",
      max,
      min: 0,
      resultLabel: "Result",
      step: 1
    },
    reducedMotionRequirements: "No animation required."
  };
}

function createCompareToggleSpec(candidate: InteractionCandidate, blockText: string, exportId: string, index: number): ComponentSpec {
  const { optionA, optionB } = extractCompareOptions(blockText);
  const fallbackText = `Interactive comparison fallback for approved candidate ${candidate.id}: ${candidate.understandingLossIfRemoved}`;

  return {
    accessibilityNotes: "Two keyboard-reachable toggle buttons with live comparison output.",
    articleId: candidate.articleId,
    candidateId: candidate.id,
    componentName: "CompareToggle",
    documentVersion: candidate.documentVersion,
    embeddedData: { blockIds: candidate.blockIds },
    fallbackText,
    id: `spec_${exportId}_${index + 1}`,
    mode: "library",
    props: {
      description: "Toggle between the two article comparison points.",
      fallbackText,
      label: "Compare the article alternatives",
      optionA: {
        body: optionA.body,
        heading: optionA.heading,
        id: "a",
        label: optionA.label
      },
      optionB: {
        body: optionB.body,
        heading: optionB.heading,
        id: "b",
        label: optionB.label
      }
    },
    reducedMotionRequirements: "No animation required."
  };
}

function extractCompareOptions(blockText: string): { optionA: { body: string; heading: string; label: string }; optionB: { body: string; heading: string; label: string } } {
  const normalized = blockText.trim();
  const [left, right] = normalized.split(/\b(?:versus|vs\.?|compared with|compared to|rather than)\b/iu, 2).map((part) => part.trim());
  const optionABody = left || "First side of the comparison from the source article.";
  const optionBBody = right || "Second side of the comparison from the source article.";

  return {
    optionA: {
      body: optionABody,
      heading: summarizeOptionHeading(optionABody, "Option A"),
      label: "A"
    },
    optionB: {
      body: optionBBody,
      heading: summarizeOptionHeading(optionBBody, "Option B"),
      label: "B"
    }
  };
}

function summarizeOptionHeading(text: string, fallback: string): string {
  const firstWords = text.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim().split(/\s+/u).filter(Boolean).slice(0, 6).join(" ");
  return firstWords || fallback;
}

function readComponentSource(componentPath: string): string {
  return readFileSync(join(findProjectRoot(), componentPath), "utf8");
}

function toLocalExportResult(record: ExportRecord): LocalExportResult {
  return {
    articleId: record.articleId,
    documentVersion: record.documentVersion,
    exportDir: record.payload.exportDir,
    exportId: record.id,
    files: record.payload.artifacts.map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 })),
    previewPath: join(record.payload.exportDir, "preview.html"),
    tagName: record.payload.tagName
  };
}

function findProjectRoot(): string {
  let currentDirectory = process.cwd();

  while (currentDirectory !== dirname(currentDirectory)) {
    if (existsSync(join(currentDirectory, "package.json")) && existsSync(join(currentDirectory, "implementation-plan.md"))) {
      return currentDirectory;
    }
    currentDirectory = dirname(currentDirectory);
  }

  return process.cwd();
}
