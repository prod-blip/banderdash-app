import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { markWorkflowCanceled } from "./cancellation.js";
import { connectDatabase, type BanderdashDatabase } from "./db.js";
import { getDebugHistory } from "./debugHistory.js";
import { createLlmLogStore } from "./llmLogs.js";
import { runMigrations } from "./migrations.js";
import { createWorkflowRunStore } from "./workflowRuns.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-debug-history-test-"));
  tempDirectories.push(directory);
  return join(directory, "state", "banderdash.sqlite");
}

function createMigratedDatabase(): BanderdashDatabase {
  const db = connectDatabase({ sqlitePath: createTempDatabasePath() });
  runMigrations(db);
  return db;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("debug history service", () => {
  it("returns workflow runs, stage events, structured logs, QA warnings, cancellations, and exports", () => {
    const db = createMigratedDatabase();
    const workflowStore = createWorkflowRunStore({ createId: createDeterministicWorkflowId(), db, now: createClock() });
    const logStore = createLlmLogStore({ createId: createDeterministicLogId(), db, now: createClock("2026-06-15T01:00") });

    try {
      insertArticleFixture(db, "article_1", 2);
      insertGeneratedSpecFixture(db, "spec_1", "candidate_1", "article_1", 2);
      const run = workflowStore.createRun({ articleId: "article_1", documentVersion: 2, payload: { source: "test" } });
      workflowStore.appendEvent(run.id, { eventType: "stage_started", stage: "Analyst", payload: { step: 1 } });
      workflowStore.appendEvent(run.id, { eventType: "stage_completed", stage: "Analyst", payload: { durationMs: 42 } });
      const running = workflowStore.updateRun(run.id, { currentStage: "Critic", status: "running" });
      markWorkflowCanceled(workflowStore, running, { incompleteStage: "Critic", reason: "user stopped it" });

      logStore.recordLog({
        articleId: "article_1",
        documentVersion: 2,
        durationMs: 42,
        nodeName: "Analyst",
        provider: "fake",
        structuredInput: { blockIds: ["block_1"] },
        structuredOutput: { candidates: [{ id: "candidate_1" }] },
        tokenUsage: { totalTokens: 12 },
        workflowRunId: run.id
      });
      insertQAResultFixture(db, "qa_1", "spec_1", "article_1", 2, "warning", {
        ok: true,
        findings: [{ code: "BASIC_LABEL_WARNING", message: "Needs label review.", severity: "warning" }]
      });
      insertExportFixture(db, "export_1", "article_1", 2);

      const history = getDebugHistory({ articleId: "article_1", db });

      expect(history).toMatchObject({ articleId: "article_1", documentVersion: 2 });
      expect(history.workflowRuns).toHaveLength(1);
      expect(history.workflowRuns[0]).toMatchObject({
        id: "workflow_run_1",
        status: "canceled",
        stageStatuses: [
          { durationMs: 42, stage: "Analyst", status: "completed" },
          { stage: "Critic", status: "canceled" }
        ]
      });
      expect(history.workflowRuns[0]?.events.map((event) => event.eventType)).toEqual([
        "stage_started",
        "stage_completed",
        "run_canceled"
      ]);
      expect(history.llmLogs).toMatchObject([{ nodeName: "Analyst", structuredInput: { blockIds: ["block_1"] }, tokenUsage: { totalTokens: 12 } }]);
      expect(history.qaResults).toMatchObject([{ generatedSpecId: "spec_1", status: "warning" }]);
      expect(history.exports).toMatchObject([{ id: "export_1", payload: { exportDir: "/tmp/export_1" } }]);
    } finally {
      db.close();
    }
  });

  it("filters debug history by requested document version", () => {
    const db = createMigratedDatabase();

    try {
      insertArticleFixture(db, "article_1", 2);
      insertWorkflowRunFixture(db, "run_v1", "article_1", 1, "completed", "2026-06-15T00:00:01.000Z");
      insertWorkflowRunFixture(db, "run_v2", "article_1", 2, "completed", "2026-06-15T00:00:02.000Z");
      insertExportFixture(db, "export_v1", "article_1", 1);
      insertExportFixture(db, "export_v2", "article_1", 2);

      const history = getDebugHistory({ articleId: "article_1", db, documentVersion: 1 });

      expect(history.documentVersion).toBe(1);
      expect(history.workflowRuns.map((run) => run.id)).toEqual(["run_v1"]);
      expect(history.exports.map((record) => record.id)).toEqual(["export_v1"]);
    } finally {
      db.close();
    }
  });
});

function insertArticleFixture(db: BanderdashDatabase, articleId: string, version: number): void {
  db.prepare("insert into articles (id, current_version, payload_json) values (?, ?, '{}')").run(articleId, version);
}

function insertGeneratedSpecFixture(db: BanderdashDatabase, specId: string, candidateId: string, articleId: string, version: number): void {
  db.prepare("insert into candidates (id, article_id, document_version, status, payload_json) values (?, ?, ?, 'survived', '{}')").run(
    candidateId,
    articleId,
    version
  );
  db.prepare("insert into generated_specs (id, candidate_id, article_id, document_version, payload_json) values (?, ?, ?, ?, '{}')").run(
    specId,
    candidateId,
    articleId,
    version
  );
}

function insertQAResultFixture(
  db: BanderdashDatabase,
  id: string,
  generatedSpecId: string,
  articleId: string,
  version: number,
  status: string,
  result: Record<string, unknown>
): void {
  db.prepare(
    "insert into qa_results (id, generated_spec_id, article_id, document_version, status, payload_json, created_at) values (?, ?, ?, ?, ?, ?, ?)"
  ).run(id, generatedSpecId, articleId, version, status, JSON.stringify(result), "2026-06-15T00:00:03.000Z");
}

function insertExportFixture(db: BanderdashDatabase, id: string, articleId: string, version: number): void {
  db.prepare(
    "insert into exports (id, article_id, document_version, manifest_json, payload_json, created_at) values (?, ?, ?, ?, ?, ?)"
  ).run(
    id,
    articleId,
    version,
    JSON.stringify({ exportId: id, schemaVersion: "1" }),
    JSON.stringify({ exportDir: `/tmp/${id}`, tagName: `ia-${id}` }),
    version === 1 ? "2026-06-15T00:00:01.000Z" : "2026-06-15T00:00:04.000Z"
  );
}

function insertWorkflowRunFixture(
  db: BanderdashDatabase,
  id: string,
  articleId: string,
  version: number,
  status: string,
  createdAt: string
): void {
  db.prepare(
    "insert into workflow_runs (id, article_id, document_version, status, payload_json, created_at, updated_at) values (?, ?, ?, ?, '{}', ?, ?)"
  ).run(id, articleId, version, status, createdAt, createdAt);
}

function createDeterministicWorkflowId() {
  const counters = { workflow_event: 0, workflow_run: 0 };
  return (prefix: "workflow_run" | "workflow_event") => {
    counters[prefix] += 1;
    return `${prefix}_${counters[prefix]}`;
  };
}

function createDeterministicLogId() {
  let counter = 0;
  return () => {
    counter += 1;
    return `llm_log_${counter}`;
  };
}

function createClock(prefix = "2026-06-15T00:00") {
  let tick = 0;
  return () => {
    tick += 1;
    return new Date(`${prefix}:${String(tick).padStart(2, "0")}.000Z`);
  };
}
