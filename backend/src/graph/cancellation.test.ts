import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { requestWorkflowCancellation } from "../services/cancellation.js";
import { connectDatabase, type BanderdashDatabase } from "../services/db.js";
import { runMigrations } from "../services/migrations.js";
import { createWorkflowRunStore } from "../services/workflowRuns.js";
import { resumeWorkflowRun, startWorkflowRun } from "./runner.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-workflow-cancellation-test-"));
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

describe("workflow cancellation", () => {
  it("cancels a pending run immediately", () => {
    const db = createMigratedDatabase();
    const store = createWorkflowRunStore({ db, createId: createDeterministicIds().next, now: createClock() });

    try {
      insertArticleFixture(db, "article_1", 1);
      const run = store.createRun({ articleId: "article_1", documentVersion: 1 });

      const canceled = requestWorkflowCancellation(store, run.id, { reason: "user stopped before run" });

      expect(canceled).toMatchObject({
        completedStages: [],
        currentStage: null,
        payload: { cancellationReason: "user stopped before run", cancellationRequested: true },
        status: "canceled"
      });
      expect(store.listEvents(run.id).map((event) => event.eventType)).toEqual(["run_cancel_requested", "run_canceled"]);
    } finally {
      db.close();
    }
  });

  it("cancels a running run between stages and keeps completed stage payload", async () => {
    const db = createMigratedDatabase();
    const ids = createDeterministicIds();
    const store = createWorkflowRunStore({ db, createId: ids.next, now: createClock() });
    let specAgentRan = false;

    try {
      insertArticleFixture(db, "article_1", 1);
      const run = await startWorkflowRun(
        {
          store,
          stages: ["Analyst", "Critic", "SpecAgent"],
          handlers: {
            Analyst: () => ({ status: "completed", payload: { analystOutput: "kept" } }),
            Critic: ({ runId }) => {
              requestWorkflowCancellation(store, runId, { reason: "user stopped during critic" });
              return { status: "completed", payload: { criticOutput: "discarded" } };
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
        payload: {
          analystOutput: "kept",
          cancellationReason: "user stopped during critic",
          cancellationRequested: true,
          canceledIncompleteStage: "Critic"
        },
        status: "canceled"
      });
      expect(run.payload).not.toHaveProperty("criticOutput");
      expect(store.listEvents(run.id).map((event) => [event.eventType, event.stage])).toEqual([
        ["run_started", null],
        ["stage_started", "Analyst"],
        ["stage_completed", "Analyst"],
        ["stage_started", "Critic"],
        ["run_cancel_requested", "Critic"],
        ["run_canceled", "Critic"]
      ]);
    } finally {
      db.close();
    }
  });

  it("does not resume a canceled run", async () => {
    const db = createMigratedDatabase();
    const ids = createDeterministicIds();
    const store = createWorkflowRunStore({ db, createId: ids.next, now: createClock() });
    let criticRan = false;

    try {
      insertArticleFixture(db, "article_1", 1);
      const run = store.createRun({ articleId: "article_1", documentVersion: 1, payload: { cancellationRequested: true } });
      const canceled = await resumeWorkflowRun(
        {
          store,
          stages: ["Analyst", "Critic"],
          handlers: {
            Critic: () => {
              criticRan = true;
              return { status: "completed" };
            }
          }
        },
        { runId: run.id }
      );

      expect(criticRan).toBe(false);
      expect(canceled).toMatchObject({ status: "canceled", currentStage: "Analyst", completedStages: [] });
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

  return {
    next(prefix: "workflow_run" | "workflow_event") {
      if (prefix === "workflow_run") {
        runCounter += 1;
        return `workflow_run_${runCounter}`;
      }

      eventCounter += 1;
      return `workflow_event_${eventCounter}`;
    }
  };
}

function createClock() {
  let tick = 0;
  return () => {
    tick += 1;
    return new Date(`2026-06-13T01:00:${String(tick).padStart(2, "0")}.000Z`);
  };
}
