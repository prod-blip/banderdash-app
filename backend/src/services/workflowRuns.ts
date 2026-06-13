import type { BanderdashDatabase } from "./db.js";
import type { WorkflowEventRecord, WorkflowEventType, WorkflowRunRecord, WorkflowStage, WorkflowStatus } from "../graph/types.js";

export interface WorkflowRunStoreOptions {
  createId?: (prefix: "workflow_run" | "workflow_event") => string;
  db: BanderdashDatabase;
  now?: () => Date;
}

export interface CreateWorkflowRunInput {
  articleId: string;
  documentVersion: number;
  payload?: Record<string, unknown>;
}

export interface UpdateWorkflowRunInput {
  currentStage?: WorkflowStage | null;
  status?: WorkflowStatus;
  completedStages?: WorkflowStage[];
  payload?: Record<string, unknown>;
}

export interface AppendWorkflowEventInput {
  eventType: WorkflowEventType;
  payload?: Record<string, unknown>;
  stage?: WorkflowStage | null;
}

export interface WorkflowRunStore {
  appendEvent(runId: string, input: AppendWorkflowEventInput): WorkflowEventRecord;
  createRun(input: CreateWorkflowRunInput): WorkflowRunRecord;
  getRun(runId: string): WorkflowRunRecord | null;
  listEvents(runId: string): WorkflowEventRecord[];
  updateRun(runId: string, input: UpdateWorkflowRunInput): WorkflowRunRecord;
}

export function createWorkflowRunStore(options: WorkflowRunStoreOptions): WorkflowRunStore {
  const createId = options.createId ?? defaultCreateId;
  const now = options.now ?? (() => new Date());

  return {
    appendEvent(runId, input) {
      const timestamp = now().toISOString();
      const event: WorkflowEventRecord = {
        id: createId("workflow_event"),
        workflowRunId: runId,
        eventType: input.eventType,
        stage: input.stage ?? null,
        payload: input.payload ?? {},
        createdAt: timestamp
      };

      options.db
        .prepare(
          `insert into workflow_events (id, workflow_run_id, event_type, payload_json, created_at)
            values (?, ?, ?, ?, ?)`
        )
        .run(event.id, event.workflowRunId, event.eventType, JSON.stringify({ stage: event.stage, ...event.payload }), event.createdAt);

      return event;
    },

    createRun(input) {
      const timestamp = now().toISOString();
      const run: WorkflowRunRecord = {
        id: createId("workflow_run"),
        articleId: input.articleId,
        documentVersion: input.documentVersion,
        status: "pending",
        currentStage: null,
        completedStages: [],
        payload: input.payload ?? {},
        createdAt: timestamp,
        updatedAt: timestamp
      };

      options.db
        .prepare(
          `insert into workflow_runs (id, article_id, document_version, status, payload_json, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(run.id, run.articleId, run.documentVersion, run.status, serializeRunPayload(run), run.createdAt, run.updatedAt);

      return run;
    },

    getRun(runId) {
      const row = options.db
        .prepare("select id, article_id, document_version, status, payload_json, created_at, updated_at from workflow_runs where id = ?")
        .get(runId) as WorkflowRunRow | undefined;

      return row ? rowToRun(row) : null;
    },

    listEvents(runId) {
      const rows = options.db
        .prepare(
          "select id, workflow_run_id, event_type, payload_json, created_at from workflow_events where workflow_run_id = ? order by created_at, id"
        )
        .all(runId) as unknown as WorkflowEventRow[];

      return rows.map(rowToEvent);
    },

    updateRun(runId, input) {
      const existing = this.getRun(runId);
      if (!existing) {
        throw new Error(`Workflow run ${runId} was not found.`);
      }

      const updated: WorkflowRunRecord = {
        ...existing,
        status: input.status ?? existing.status,
        currentStage: input.currentStage === undefined ? existing.currentStage : input.currentStage,
        completedStages: input.completedStages ?? existing.completedStages,
        payload: input.payload ?? existing.payload,
        updatedAt: now().toISOString()
      };

      options.db
        .prepare("update workflow_runs set status = ?, payload_json = ?, updated_at = ? where id = ?")
        .run(updated.status, serializeRunPayload(updated), updated.updatedAt, runId);

      return updated;
    }
  };
}

function serializeRunPayload(run: Pick<WorkflowRunRecord, "completedStages" | "currentStage" | "payload">): string {
  return JSON.stringify({
    ...run.payload,
    completedStages: run.completedStages,
    currentStage: run.currentStage
  });
}

function rowToRun(row: WorkflowRunRow): WorkflowRunRecord {
  const payload = parseJsonRecord(row.payload_json);
  const completedStages = parseWorkflowStages(payload.completedStages);
  const currentStage = typeof payload.currentStage === "string" ? (payload.currentStage as WorkflowStage) : null;
  delete payload.completedStages;
  delete payload.currentStage;

  return {
    id: row.id,
    articleId: row.article_id,
    documentVersion: row.document_version,
    status: row.status as WorkflowStatus,
    currentStage,
    completedStages,
    payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToEvent(row: WorkflowEventRow): WorkflowEventRecord {
  const payload = parseJsonRecord(row.payload_json);
  const stage = typeof payload.stage === "string" ? (payload.stage as WorkflowStage) : null;
  delete payload.stage;

  return {
    id: row.id,
    workflowRunId: row.workflow_run_id,
    eventType: row.event_type as WorkflowEventType,
    stage,
    payload,
    createdAt: row.created_at
  };
}

function parseWorkflowStages(value: unknown): WorkflowStage[] {
  return Array.isArray(value) ? (value.filter((stage) => typeof stage === "string") as WorkflowStage[]) : [];
}

function parseJsonRecord(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? { ...(parsed as Record<string, unknown>) } : {};
}

function defaultCreateId(prefix: "workflow_run" | "workflow_event"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

interface WorkflowRunRow {
  article_id: string;
  created_at: string;
  document_version: number;
  id: string;
  payload_json: string;
  status: string;
  updated_at: string;
}

interface WorkflowEventRow {
  created_at: string;
  event_type: string;
  id: string;
  payload_json: string;
  workflow_run_id: string;
}
