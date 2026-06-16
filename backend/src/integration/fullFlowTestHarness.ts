import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ArticleDoc } from "@banderdash/doc-model";
import { createFakeProvider } from "@banderdash/providers";
import { startWorkflowRun, resumeWorkflowRun } from "../graph/runner.js";
import type { WorkflowStageHandlers, WorkflowRunRecord } from "../graph/types.js";
import { runAnalystNode } from "../nodes/analyst.js";
import { runLibraryBuilderNode, type LibraryBuildUnit } from "../nodes/builder.js";
import { runCriticNode } from "../nodes/critic.js";
import { runSandboxQANode } from "../nodes/sandboxQA.js";
import type { InteractionCandidate } from "../nodes/schemas/candidate.js";
import type { ComponentSpec } from "../nodes/schemas/componentSpec.js";
import { runSpecAgentNode } from "../nodes/specAgent.js";
import { runStaticValidatorNode, type StaticValidationRecord } from "../nodes/staticValidator.js";
import { createArticleService } from "../services/articles.js";
import { createCandidateConsentService } from "../services/candidateConsent.js";
import { connectDatabase, type BanderdashDatabase } from "../services/db.js";
import { createExportRecord, type ExportRecord } from "../services/exports.js";
import { runMigrations } from "../services/migrations.js";
import type { SandboxQARecord } from "../services/qaResults.js";
import { createWorkflowRunStore, type WorkflowRunStore } from "../services/workflowRuns.js";

export interface FullLibraryFlowFixture {
  articleText: string;
  candidateId: string;
  createCandidate: (article: ArticleDoc) => InteractionCandidate;
  createSpec: (article: ArticleDoc, candidate: InteractionCandidate) => ComponentSpec;
  exportId: string;
  tempPrefix: string;
}

export interface FullLibraryFlowResult {
  article: ArticleDoc;
  buildUnits: LibraryBuildUnit[];
  db: BanderdashDatabase;
  exportRecord: ExportRecord;
  outputDir: string;
  pausedRun: WorkflowRunRecord;
  qaRecords: SandboxQARecord[];
  store: WorkflowRunStore;
  tempDirectory: string;
  validationRecords: StaticValidationRecord[];
  completedRun: WorkflowRunRecord;
}

export async function runFullLibraryFlow(fixture: FullLibraryFlowFixture): Promise<FullLibraryFlowResult> {
  const tempDirectory = mkdtempSync(join(tmpdir(), fixture.tempPrefix));
  const db = connectDatabase({ sqlitePath: join(tempDirectory, "state", "banderdash.sqlite") });
  runMigrations(db);
  const articleService = createArticleService({ createId: () => `article_${fixture.candidateId}`, db });
  const article = await articleService.createArticle(fixture.articleText);
  const outputDir = join(tempDirectory, "exports");
  mkdirSync(outputDir, { recursive: true });

  let approved = false;
  let proposedCandidates: InteractionCandidate[] = [];
  let survivedCandidates: InteractionCandidate[] = [];
  let specs: ComponentSpec[] = [];
  let buildUnits: LibraryBuildUnit[] = [];
  let validationRecords: StaticValidationRecord[] = [];
  let qaRecords: SandboxQARecord[] = [];
  let exportRecord: ExportRecord | null = null;

  const store = createWorkflowRunStore({
    createId: createDeterministicWorkflowId(),
    db,
    now: () => new Date("2026-06-16T00:00:00.000Z")
  });
  const componentSourceByPath = readComponentSourceByPath();

  const handlers: WorkflowStageHandlers = {
    Structurer: () => ({
      status: "completed",
      payload: { blockCount: article.blocks.length }
    }),
    Analyst: async () => {
      const candidate = fixture.createCandidate(article);
      proposedCandidates = await runAnalystNode({
        article,
        db,
        model: "fake-model",
        now: () => new Date("2026-06-16T00:01:00.000Z"),
        provider: createFakeProvider({ structuredValue: { candidates: [candidate] } })
      });
      return { status: "completed", payload: { candidateIds: proposedCandidates.map((entry) => entry.id) } };
    },
    Critic: async () => {
      survivedCandidates = await runCriticNode({
        article,
        candidates: proposedCandidates,
        db,
        model: "fake-model",
        now: () => new Date("2026-06-16T00:02:00.000Z"),
        provider: createFakeProvider({
          structuredValue: { candidates: proposedCandidates.map((entry) => ({ ...entry, status: "survived" })) }
        })
      });
      return { status: "completed", payload: { survivedCandidateIds: survivedCandidates.map((entry) => entry.id) } };
    },
    ConsentDataGap: () => {
      if (!approved) {
        return { status: "waiting_for_user", payload: { awaitingApprovalCandidateIds: survivedCandidates.map((entry) => entry.id) } };
      }
      return { status: "completed", payload: { approvedCandidateIds: survivedCandidates.map((entry) => entry.id) } };
    },
    SpecAgent: async () => {
      specs = await runSpecAgentNode({
        article,
        candidates: survivedCandidates,
        db,
        model: "fake-model",
        now: () => new Date("2026-06-16T00:03:00.000Z"),
        provider: createFakeProvider({ structuredValue: { specs: [fixture.createSpec(article, survivedCandidates[0]!)] } })
      });
      return { status: "completed", payload: { specIds: specs.map((entry) => entry.id) } };
    },
    Builder: () => {
      buildUnits = runLibraryBuilderNode({ specs });
      return { status: "completed", payload: { buildUnitIds: buildUnits.map((entry) => entry.id) } };
    },
    StaticValidator: () => {
      validationRecords = runStaticValidatorNode({
        buildUnits,
        componentSourceByPath,
        db,
        now: () => new Date("2026-06-16T00:04:00.000Z")
      });
      return { status: "completed", payload: { validationStatuses: validationRecords.map((entry) => entry.status) } };
    },
    SandboxQA: () => {
      qaRecords = runSandboxQANode({
        buildUnits,
        componentSourceByPath,
        db,
        mountComponent: () => undefined,
        now: () => new Date("2026-06-16T00:05:00.000Z")
      });
      return { status: "completed", payload: { qaStatuses: qaRecords.map((entry) => entry.status) } };
    },
    Export: async () => {
      exportRecord = await createExportRecord({
        article,
        buildUnits,
        componentLibraryVersion: "0.1.0",
        createId: () => fixture.exportId,
        db,
        now: () => new Date("2026-06-16T00:06:00.000Z"),
        outputDir,
        qaOverrideConfirmed: true,
        qaRecords,
        validationRecords
      });
      return { status: "completed", payload: { exportId: exportRecord.id } };
    }
  };

  const pausedRun = await startWorkflowRun({ handlers, store }, { articleId: article.id, documentVersion: article.version });
  createCandidateConsentService({ createId: () => `approval_${fixture.candidateId}`, db }).recordConsent({
    articleId: article.id,
    candidateId: fixture.candidateId,
    decision: "approved",
    expectedVersion: article.version
  });
  approved = true;
  const completedRun = await resumeWorkflowRun({ handlers, store }, { runId: pausedRun.id });

  if (!exportRecord) {
    throw new Error("Expected the full library flow to create an export record.");
  }

  return {
    article,
    buildUnits,
    completedRun,
    db,
    exportRecord,
    outputDir,
    pausedRun,
    qaRecords,
    store,
    tempDirectory,
    validationRecords
  };
}

export function cleanupFullLibraryFlowResult(result: Pick<FullLibraryFlowResult, "db" | "tempDirectory"> | null): void {
  if (!result) {
    return;
  }
  result.db.close();
  rmSync(result.tempDirectory, { force: true, recursive: true });
}

function readComponentSourceByPath(): Record<string, string> {
  return {
    "packages/components/src/CompareToggle.svelte": readComponentSource("packages/components/src/CompareToggle.svelte"),
    "packages/components/src/ReactiveValue.svelte": readComponentSource("packages/components/src/ReactiveValue.svelte")
  };
}

function readComponentSource(componentPath: string): string {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  return readFileSync(join(repoRoot, componentPath), "utf8");
}

function createDeterministicWorkflowId(): (prefix: "workflow_run" | "workflow_event") => string {
  const counters: Record<"workflow_run" | "workflow_event", number> = { workflow_event: 0, workflow_run: 0 };
  return (prefix) => {
    counters[prefix] += 1;
    return `${prefix}_${counters[prefix]}`;
  };
}
