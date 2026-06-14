import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { connectDatabase, type BanderdashDatabase } from "../services/db.js";
import { createLlmLogStore } from "../services/llmLogs.js";
import { runMigrations } from "../services/migrations.js";
import { createWorkflowRunStore } from "../services/workflowRuns.js";
import { resumeWorkflowRun, startWorkflowRun } from "./runner.js";
import type { WorkflowStage } from "./types.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-workflow-runner-test-"));
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

describe("workflow graph runner", () => {
  it("persists stage transitions and completes fake nodes in order", async () => {
    const db = createMigratedDatabase();
    const ids = createDeterministicIds();
    const store = createWorkflowRunStore({ db, createId: ids.next, now: createClock() });
    const executedStages: WorkflowStage[] = [];

    try {
      insertArticleFixture(db, "article_1", 3);
      const run = await startWorkflowRun(
        {
          store,
          stages: ["Analyst", "Critic", "SpecAgent"],
          handlers: {
            Analyst: ({ stage }) => {
              executedStages.push(stage);
              return { status: "completed", payload: { analystCandidates: 2 } };
            },
            Critic: ({ payload, stage }) => {
              executedStages.push(stage);
              return { status: "completed", payload: { criticSawCandidates: payload.analystCandidates } };
            },
            SpecAgent: ({ stage }) => {
              executedStages.push(stage);
              return { status: "completed", payload: { specsGenerated: 1 } };
            }
          }
        },
        { articleId: "article_1", documentVersion: 3, payload: { startedBy: "test" } }
      );

      expect(run).toMatchObject({
        articleId: "article_1",
        completedStages: ["Analyst", "Critic", "SpecAgent"],
        currentStage: null,
        documentVersion: 3,
        payload: { analystCandidates: 2, criticSawCandidates: 2, specsGenerated: 1, startedBy: "test" },
        status: "completed"
      });
      expect(executedStages).toEqual(["Analyst", "Critic", "SpecAgent"]);
      expect(store.getRun(run.id)).toMatchObject({ status: "completed", completedStages: ["Analyst", "Critic", "SpecAgent"] });
      expect(store.listEvents(run.id).map((event) => [event.eventType, event.stage])).toEqual([
        ["run_started", null],
        ["stage_started", "Analyst"],
        ["stage_completed", "Analyst"],
        ["stage_started", "Critic"],
        ["stage_completed", "Critic"],
        ["stage_started", "SpecAgent"],
        ["stage_completed", "SpecAgent"],
        ["run_completed", null]
      ]);
    } finally {
      db.close();
    }
  });

  it("pauses when a stage waits for user input and resumes from persisted state", async () => {
    const db = createMigratedDatabase();
    const ids = createDeterministicIds();
    const store = createWorkflowRunStore({ db, createId: ids.next, now: createClock() });
    let criticAttempts = 0;

    try {
      insertArticleFixture(db, "article_1", 1);
      const pausedRun = await startWorkflowRun(
        {
          store,
          stages: ["Analyst", "ConsentDataGap", "SpecAgent"],
          handlers: {
            Analyst: () => ({ status: "completed", payload: { candidatesPersisted: true } }),
            ConsentDataGap: () => ({ status: "waiting_for_user", payload: { waitingFor: "approval" } }),
            SpecAgent: () => ({ status: "completed", payload: { shouldNotRunYet: true } })
          }
        },
        { articleId: "article_1", documentVersion: 1 }
      );

      expect(pausedRun).toMatchObject({
        completedStages: ["Analyst"],
        currentStage: "ConsentDataGap",
        payload: { candidatesPersisted: true, waitingFor: "approval" },
        status: "waiting_for_user"
      });

      const resumedRun = await resumeWorkflowRun(
        {
          store,
          stages: ["Analyst", "Critic", "SpecAgent"],
          handlers: {
            Critic: () => {
              criticAttempts += 1;
              return { status: "completed", payload: { resumedCritic: true } };
            },
            SpecAgent: () => ({ status: "completed", payload: { specsGenerated: true } })
          }
        },
        { runId: pausedRun.id }
      );

      expect(criticAttempts).toBe(1);
      expect(resumedRun).toMatchObject({
        completedStages: ["Analyst", "Critic", "SpecAgent"],
        currentStage: null,
        payload: { candidatesPersisted: true, resumedCritic: true, specsGenerated: true, waitingFor: "approval" },
        status: "completed"
      });
    } finally {
      db.close();
    }
  });

  it("persists failed stage and error event without advancing later stages", async () => {
    const db = createMigratedDatabase();
    const ids = createDeterministicIds();
    const store = createWorkflowRunStore({ db, createId: ids.next, now: createClock() });
    let specAgentRan = false;

    try {
      insertArticleFixture(db, "article_1", 3);
      const run = await startWorkflowRun(
        {
          store,
          stages: ["Analyst", "Critic", "SpecAgent"],
          handlers: {
            Analyst: () => ({ status: "completed" }),
            Critic: () => {
              throw new Error("critic failed");
            },
            SpecAgent: () => {
              specAgentRan = true;
              return { status: "completed" };
            }
          }
        },
        { articleId: "article_1", documentVersion: 1 }
      );

      expect(specAgentRan).toBe(false);
      expect(run).toMatchObject({
        completedStages: ["Analyst"],
        currentStage: "Critic",
        payload: { error: "critic failed" },
        status: "failed"
      });
      expect(store.listEvents(run.id).map((event) => event.eventType)).toEqual([
        "run_started",
        "stage_started",
        "stage_completed",
        "stage_started",
        "stage_failed",
        "run_failed"
      ]);
    } finally {
      db.close();
    }
  });

  it("records structured debug logs for completed and failed stage execution", async () => {
    const db = createMigratedDatabase();
    const ids = createDeterministicIds();
    const store = createWorkflowRunStore({ db, createId: ids.next, now: createClock() });
    const debugLogStore = createLlmLogStore({ db, createId: ids.nextLog, now: createClock() });

    try {
      insertArticleFixture(db, "article_1", 1);
      const run = await startWorkflowRun(
        {
          debugLogStore,
          handlers: {
            Analyst: () => ({ status: "completed", payload: { candidatesPersisted: 2 } }),
            Critic: () => {
              throw new Error("critic failed");
            }
          },
          now: createDurationClock(),
          stages: ["Analyst", "Critic"],
          store
        },
        { articleId: "article_1", documentVersion: 1, payload: { startedBy: "test" } }
      );

      expect(run.status).toBe("failed");
      expect(debugLogStore.listForRun(run.id)).toEqual([
        expect.objectContaining({
          articleId: "article_1",
          documentVersion: 1,
          durationMs: 5,
          id: "llm_log_1",
          nodeName: "Analyst",
          structuredInput: { payload: { startedBy: "test" }, stage: "Analyst" },
          structuredOutput: { payload: { candidatesPersisted: 2 }, status: "completed" }
        }),
        expect.objectContaining({
          durationMs: 5,
          error: { message: "critic failed", name: "Error" },
          id: "llm_log_2",
          nodeName: "Critic",
          structuredInput: { payload: { candidatesPersisted: 2, startedBy: "test" }, stage: "Critic" },
          structuredOutput: undefined
        })
      ]);
    } finally {
      db.close();
    }
  });
});

function insertArticleFixture(db: BanderdashDatabase, articleId: string, version: number): void {
  db.prepare("insert into articles (id, current_version, payload_json) values (?, ?, '{}')").run(articleId, version);
}

function createDeterministicIds() {
  let runCounter = 0;
  let eventCounter = 0;
  let logCounter = 0;

  return {
    next(prefix: "workflow_run" | "workflow_event") {
      if (prefix === "workflow_run") {
        runCounter += 1;
        return `workflow_run_${runCounter}`;
      }

      eventCounter += 1;
      return `workflow_event_${eventCounter}`;
    },
    nextLog() {
      logCounter += 1;
      return `llm_log_${logCounter}`;
    }
  };
}

function createClock() {
  let tick = 0;
  return () => {
    tick += 1;
    return new Date(`2026-06-13T00:00:${String(tick).padStart(2, "0")}.000Z`);
  };
}

function createDurationClock() {
  let timeMs = 0;
  return () => {
    const current = new Date(timeMs);
    timeMs += 5;
    return current;
  };
}
