import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { connectDatabase, type BanderdashDatabase } from "./db.js";
import { createLlmLogStore } from "./llmLogs.js";
import { runMigrations } from "./migrations.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-llm-logs-test-"));
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

describe("LLM/debug log store", () => {
  it("stores structured node input, validated output, timing, and token/cost metadata", () => {
    const db = createMigratedDatabase();
    const logStore = createLlmLogStore({ db, createId: createDeterministicLogId(), now: createClock() });

    try {
      insertArticleFixture(db, "article_1", 2);
      insertWorkflowRunFixture(db, "workflow_run_1", "article_1", 2);

      const log = logStore.recordLog({
        articleId: "article_1",
        cost: { currency: "USD", total: 0.00042 },
        documentVersion: 2,
        durationMs: 42,
        model: "fake-model",
        nodeName: "Analyst",
        provider: "fake",
        structuredInput: { blockIds: ["block_1"], promptShape: "candidate-request" },
        structuredOutput: { candidates: [{ id: "candidate_1", status: "proposed" }] },
        tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        workflowRunId: "workflow_run_1"
      });

      expect(log).toMatchObject({
        articleId: "article_1",
        cost: { currency: "USD", total: 0.00042 },
        createdAt: "2026-06-13T00:00:01.000Z",
        documentVersion: 2,
        durationMs: 42,
        id: "llm_log_1",
        model: "fake-model",
        nodeName: "Analyst",
        provider: "fake",
        tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        workflowRunId: "workflow_run_1"
      });

      expect(logStore.listForRun("workflow_run_1")).toEqual([log]);
    } finally {
      db.close();
    }
  });

  it("stores structured error and timing details", () => {
    const db = createMigratedDatabase();
    const logStore = createLlmLogStore({ db, createId: createDeterministicLogId(), now: createClock() });

    try {
      insertArticleFixture(db, "article_1", 1);
      insertWorkflowRunFixture(db, "workflow_run_1", "article_1", 1);

      const log = logStore.recordLog({
        articleId: "article_1",
        documentVersion: 1,
        durationMs: 7,
        error: { message: "provider rejected structured output", name: "ProviderError" },
        nodeName: "Critic",
        structuredInput: { candidateIds: ["candidate_1"] },
        workflowRunId: "workflow_run_1"
      });

      expect(logStore.listForRun("workflow_run_1")).toEqual([
        expect.objectContaining({
          durationMs: 7,
          error: { message: "provider rejected structured output", name: "ProviderError" },
          id: log.id,
          nodeName: "Critic",
          structuredInput: { candidateIds: ["candidate_1"] },
          structuredOutput: undefined
        })
      ]);
    } finally {
      db.close();
    }
  });

  it("rejects raw provider request or response dumps in structured payloads", () => {
    const db = createMigratedDatabase();
    const logStore = createLlmLogStore({ db, createId: createDeterministicLogId(), now: createClock() });

    try {
      insertArticleFixture(db, "article_1", 1);

      expect(() =>
        logStore.recordLog({
          articleId: "article_1",
          documentVersion: 1,
          nodeName: "Analyst",
          structuredInput: { safe: true, nested: { rawProviderRequest: { messages: ["do not store this"] } } }
        })
      ).toThrow(/forbidden raw provider dump field/);

      const rows = db.prepare("select id from llm_logs").all() as Array<{ id: string }>;
      expect(rows).toEqual([]);
    } finally {
      db.close();
    }
  });
});

function insertArticleFixture(db: BanderdashDatabase, articleId: string, version: number): void {
  db.prepare("insert into articles (id, current_version, payload_json) values (?, ?, '{}')").run(articleId, version);
}

function insertWorkflowRunFixture(db: BanderdashDatabase, runId: string, articleId: string, documentVersion: number): void {
  db.prepare(
    "insert into workflow_runs (id, article_id, document_version, status, payload_json) values (?, ?, ?, 'running', '{}')"
  ).run(runId, articleId, documentVersion);
}

function createDeterministicLogId() {
  let counter = 0;
  return () => {
    counter += 1;
    return `llm_log_${counter}`;
  };
}

function createClock() {
  let tick = 0;
  return () => {
    tick += 1;
    return new Date(`2026-06-13T00:00:${String(tick).padStart(2, "0")}.000Z`);
  };
}
