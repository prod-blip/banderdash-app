import type { WorkflowEventType, WorkflowStage, WorkflowStatus } from "../graph/types.js";
import type { BanderdashDatabase } from "./db.js";
import type { CostMetadata, TokenUsageMetadata } from "./llmLogs.js";

export interface DebugHistoryOptions {
  articleId: string;
  db: BanderdashDatabase;
  documentVersion?: number;
}

export interface DebugHistory {
  articleId: string;
  documentVersion: number | null;
  workflowRuns: DebugWorkflowRun[];
  llmLogs: DebugLlmLog[];
  qaResults: DebugQAResult[];
  exports: DebugExportRecord[];
}

export interface DebugWorkflowRun {
  id: string;
  articleId: string;
  documentVersion: number;
  status: WorkflowStatus;
  currentStage: WorkflowStage | null;
  completedStages: WorkflowStage[];
  payload: Record<string, unknown>;
  events: DebugWorkflowEvent[];
  stageStatuses: DebugStageStatus[];
  createdAt: string;
  updatedAt: string;
}

export interface DebugWorkflowEvent {
  id: string;
  workflowRunId: string;
  eventType: WorkflowEventType;
  stage: WorkflowStage | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface DebugStageStatus {
  stage: WorkflowStage;
  status: "started" | "completed" | "waiting_for_user" | "failed" | "canceled";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: Record<string, unknown>;
}

export interface DebugLlmLog {
  id: string;
  workflowRunId: string | null;
  articleId: string;
  documentVersion: number;
  nodeName: string;
  provider: string | null;
  model: string | null;
  durationMs?: number;
  structuredInput?: Record<string, unknown>;
  structuredOutput?: Record<string, unknown>;
  error?: Record<string, unknown>;
  tokenUsage?: TokenUsageMetadata;
  cost?: CostMetadata;
  createdAt: string;
}

export interface DebugQAResult {
  id: string;
  generatedSpecId: string;
  articleId: string;
  documentVersion: number;
  status: string;
  result: Record<string, unknown>;
  createdAt: string;
}

export interface DebugExportRecord {
  id: string;
  articleId: string;
  documentVersion: number;
  manifest: Record<string, unknown>;
  payload: Record<string, unknown>;
  createdAt: string;
}

export function getDebugHistory(options: DebugHistoryOptions): DebugHistory {
  const articleId = options.articleId.trim();
  if (!articleId) {
    throw new Error("articleId is required.");
  }

  const latestVersion = getLatestDocumentVersion(options.db, articleId);
  const documentVersion = options.documentVersion ?? latestVersion;
  const versionFilter = documentVersion ?? undefined;

  const workflowRuns = listWorkflowRuns(options.db, articleId, versionFilter);
  const eventsByRunId = groupBy(listWorkflowEvents(options.db, workflowRuns.map((run) => run.id)), (event) => event.workflowRunId);

  const runsWithEvents = workflowRuns.map((run) => {
    const events = eventsByRunId.get(run.id) ?? [];
    return {
      ...run,
      events,
      stageStatuses: buildStageStatuses(events)
    };
  });

  return {
    articleId,
    documentVersion: documentVersion ?? null,
    workflowRuns: runsWithEvents,
    llmLogs: listLlmLogs(options.db, articleId, versionFilter),
    qaResults: listQAResults(options.db, articleId, versionFilter),
    exports: listExports(options.db, articleId, versionFilter)
  };
}

function getLatestDocumentVersion(db: BanderdashDatabase, articleId: string): number | null {
  const row = db.prepare("select current_version from articles where id = ?").get(articleId) as { current_version: number } | undefined;
  return row?.current_version ?? null;
}

function listWorkflowRuns(db: BanderdashDatabase, articleId: string, documentVersion: number | undefined): DebugWorkflowRun[] {
  const rows = (documentVersion
    ? db
        .prepare(
          `select id, article_id, document_version, status, payload_json, created_at, updated_at
            from workflow_runs
            where article_id = ? and document_version = ?
            order by created_at desc, id desc`
        )
        .all(articleId, documentVersion)
    : db
        .prepare(
          `select id, article_id, document_version, status, payload_json, created_at, updated_at
            from workflow_runs
            where article_id = ?
            order by created_at desc, id desc`
        )
        .all(articleId)) as unknown as WorkflowRunRow[];

  return rows.map((row) => {
    const payload = parseJsonRecord(row.payload_json);
    const completedStages = parseWorkflowStages(payload.completedStages);
    const currentStage = typeof payload.currentStage === "string" ? (payload.currentStage as WorkflowStage) : null;
    delete payload.completedStages;
    delete payload.currentStage;

    return {
      articleId: row.article_id,
      completedStages,
      createdAt: row.created_at,
      currentStage,
      documentVersion: row.document_version,
      events: [],
      id: row.id,
      payload,
      stageStatuses: [],
      status: row.status as WorkflowStatus,
      updatedAt: row.updated_at
    };
  });
}

function listWorkflowEvents(db: BanderdashDatabase, runIds: string[]): DebugWorkflowEvent[] {
  if (runIds.length === 0) {
    return [];
  }

  const placeholders = runIds.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `select id, workflow_run_id, event_type, payload_json, created_at
        from workflow_events
        where workflow_run_id in (${placeholders})
        order by created_at, id`
    )
    .all(...runIds) as unknown as WorkflowEventRow[];

  return rows.map((row) => {
    const payload = parseJsonRecord(row.payload_json);
    const stage = typeof payload.stage === "string" ? (payload.stage as WorkflowStage) : null;
    delete payload.stage;
    return {
      createdAt: row.created_at,
      eventType: row.event_type as WorkflowEventType,
      id: row.id,
      payload,
      stage,
      workflowRunId: row.workflow_run_id
    };
  });
}

function buildStageStatuses(events: DebugWorkflowEvent[]): DebugStageStatus[] {
  const byStage = new Map<WorkflowStage, DebugStageStatus>();

  for (const event of events) {
    if (!event.stage) {
      continue;
    }

    const status = byStage.get(event.stage) ?? { stage: event.stage, status: "started" };
    switch (event.eventType) {
      case "stage_started":
        status.status = "started";
        status.startedAt = event.createdAt;
        break;
      case "stage_completed":
        status.status = "completed";
        status.completedAt = event.createdAt;
        status.durationMs = readDurationMs(event.payload) ?? status.durationMs;
        break;
      case "stage_waiting_for_user":
        status.status = "waiting_for_user";
        status.completedAt = event.createdAt;
        break;
      case "stage_failed":
        status.status = "failed";
        status.completedAt = event.createdAt;
        status.error = isRecord(event.payload.error) ? event.payload.error : event.payload;
        break;
      case "run_canceled":
        status.status = "canceled";
        status.completedAt = event.createdAt;
        break;
      default:
        break;
    }
    byStage.set(event.stage, status);
  }

  return [...byStage.values()];
}

function listLlmLogs(db: BanderdashDatabase, articleId: string, documentVersion: number | undefined): DebugLlmLog[] {
  const rows = (documentVersion
    ? db
        .prepare(
          `select id, workflow_run_id, article_id, document_version, provider, model, payload_json, created_at
            from llm_logs
            where article_id = ? and document_version = ?
            order by created_at desc, id desc`
        )
        .all(articleId, documentVersion)
    : db
        .prepare(
          `select id, workflow_run_id, article_id, document_version, provider, model, payload_json, created_at
            from llm_logs
            where article_id = ?
            order by created_at desc, id desc`
        )
        .all(articleId)) as unknown as LlmLogRow[];

  return rows.map((row) => {
    const payload = parseJsonRecord(row.payload_json);
    return {
      articleId: row.article_id,
      cost: isCostMetadata(payload.cost) ? payload.cost : undefined,
      createdAt: row.created_at,
      documentVersion: row.document_version,
      durationMs: typeof payload.durationMs === "number" ? payload.durationMs : undefined,
      error: isRecord(payload.error) ? payload.error : undefined,
      id: row.id,
      model: row.model,
      nodeName: typeof payload.nodeName === "string" ? payload.nodeName : "unknown",
      provider: row.provider,
      structuredInput: isRecord(payload.structuredInput) ? payload.structuredInput : undefined,
      structuredOutput: isRecord(payload.structuredOutput) ? payload.structuredOutput : undefined,
      tokenUsage: isTokenUsageMetadata(payload.tokenUsage) ? payload.tokenUsage : undefined,
      workflowRunId: row.workflow_run_id
    };
  });
}

function listQAResults(db: BanderdashDatabase, articleId: string, documentVersion: number | undefined): DebugQAResult[] {
  const rows = (documentVersion
    ? db
        .prepare(
          `select id, generated_spec_id, article_id, document_version, status, payload_json, created_at
            from qa_results
            where article_id = ? and document_version = ?
            order by created_at desc, id desc`
        )
        .all(articleId, documentVersion)
    : db
        .prepare(
          `select id, generated_spec_id, article_id, document_version, status, payload_json, created_at
            from qa_results
            where article_id = ?
            order by created_at desc, id desc`
        )
        .all(articleId)) as unknown as QAResultRow[];

  return rows.map((row) => ({
    articleId: row.article_id,
    createdAt: row.created_at,
    documentVersion: row.document_version,
    generatedSpecId: row.generated_spec_id,
    id: row.id,
    result: parseJsonRecord(row.payload_json),
    status: row.status
  }));
}

function listExports(db: BanderdashDatabase, articleId: string, documentVersion: number | undefined): DebugExportRecord[] {
  const rows = (documentVersion
    ? db
        .prepare(
          `select id, article_id, document_version, manifest_json, payload_json, created_at
            from exports
            where article_id = ? and document_version = ?
            order by created_at desc, id desc`
        )
        .all(articleId, documentVersion)
    : db
        .prepare(
          `select id, article_id, document_version, manifest_json, payload_json, created_at
            from exports
            where article_id = ?
            order by created_at desc, id desc`
        )
        .all(articleId)) as unknown as ExportRow[];

  return rows.map((row) => ({
    articleId: row.article_id,
    createdAt: row.created_at,
    documentVersion: row.document_version,
    id: row.id,
    manifest: parseJsonRecord(row.manifest_json),
    payload: parseJsonRecord(row.payload_json)
  }));
}

function readDurationMs(payload: Record<string, unknown>): number | undefined {
  return typeof payload.durationMs === "number" ? payload.durationMs : undefined;
}

function parseJsonRecord(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  return isRecord(parsed) ? { ...parsed } : {};
}

function parseWorkflowStages(value: unknown): WorkflowStage[] {
  return Array.isArray(value) ? (value.filter((stage) => typeof stage === "string") as WorkflowStage[]) : [];
}

function groupBy<T, K>(items: T[], getKey: (item: T) => K): Map<K, T[]> {
  const grouped = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTokenUsageMetadata(value: unknown): value is TokenUsageMetadata {
  return isRecord(value) && ["inputTokens", "outputTokens", "totalTokens"].some((key) => typeof value[key] === "number");
}

function isCostMetadata(value: unknown): value is CostMetadata {
  return isRecord(value) && typeof value.currency === "string" && typeof value.total === "number";
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

interface LlmLogRow {
  article_id: string;
  created_at: string;
  document_version: number;
  id: string;
  model: string | null;
  payload_json: string;
  provider: string | null;
  workflow_run_id: string | null;
}

interface QAResultRow {
  article_id: string;
  created_at: string;
  document_version: number;
  generated_spec_id: string;
  id: string;
  payload_json: string;
  status: string;
}

interface ExportRow {
  article_id: string;
  created_at: string;
  document_version: number;
  id: string;
  manifest_json: string;
  payload_json: string;
}
