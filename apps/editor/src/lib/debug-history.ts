import type { ArticleDoc } from "@banderdash/doc-model";
import type { FetchLike } from "./article-editor";

export type DebugHistoryStatus = "idle" | "loading" | "ready" | "empty" | "error";

export interface DebugHistoryState {
  status: DebugHistoryStatus;
  message: string;
  history: DebugHistoryResponse | null;
}

export interface DebugHistoryResponse {
  articleId: string;
  documentVersion: number | null;
  workflowRuns: DebugWorkflowRun[];
  llmLogs: DebugLlmLog[];
  qaResults: DebugQAResult[];
  exports: DebugExportRecord[];
}

export interface DebugWorkflowRun {
  id: string;
  documentVersion: number;
  status: string;
  currentStage: string | null;
  completedStages: string[];
  stageStatuses: DebugStageStatus[];
  events: DebugWorkflowEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface DebugWorkflowEvent {
  id: string;
  eventType: string;
  stage: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface DebugStageStatus {
  stage: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: Record<string, unknown>;
}

export interface DebugLlmLog {
  id: string;
  workflowRunId: string | null;
  documentVersion: number;
  nodeName: string;
  provider: string | null;
  model: string | null;
  durationMs?: number;
  structuredInput?: Record<string, unknown>;
  structuredOutput?: Record<string, unknown>;
  error?: Record<string, unknown>;
  tokenUsage?: Record<string, unknown>;
  cost?: Record<string, unknown>;
  createdAt: string;
}

export interface DebugQAResult {
  id: string;
  generatedSpecId: string;
  documentVersion: number;
  status: string;
  result: Record<string, unknown>;
  createdAt: string;
}

export interface DebugExportRecord {
  id: string;
  documentVersion: number;
  manifest: Record<string, unknown>;
  payload: Record<string, unknown>;
  createdAt: string;
}

export function createInitialDebugHistoryState(): DebugHistoryState {
  return {
    status: "idle",
    message: "Optional diagnostics for inspecting workflow runs, QA records, and exports.",
    history: null
  };
}

export function canLoadDebugHistory(article: ArticleDoc | null, status: DebugHistoryStatus): boolean {
  return Boolean(article) && status !== "loading";
}

export async function loadDebugHistory(fetcher: FetchLike, article: ArticleDoc | null): Promise<DebugHistoryState> {
  if (!article) {
    return { status: "error", message: "Save an article before loading debug history.", history: null };
  }

  const response = await fetcher(`/api/debug/articles/${article.id}?version=${article.version}`);
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return { status: "error", message: readApiErrorMessage(payload, response.status), history: null };
  }
  if (!isDebugHistoryResponse(payload)) {
    return { status: "error", message: "Debug history API returned an invalid response.", history: null };
  }

  const itemCount = payload.workflowRuns.length + payload.llmLogs.length + payload.qaResults.length + payload.exports.length;
  return {
    status: itemCount === 0 ? "empty" : "ready",
    message: itemCount === 0 ? "No workflow history has been recorded for this article version yet." : `Loaded ${itemCount} debug item${itemCount === 1 ? "" : "s"} for v${article.version}.`,
    history: payload
  };
}

function isDebugHistoryResponse(value: unknown): value is DebugHistoryResponse {
  return (
    isRecord(value) &&
    typeof value.articleId === "string" &&
    (typeof value.documentVersion === "number" || value.documentVersion === null) &&
    Array.isArray(value.workflowRuns) &&
    value.workflowRuns.every(isDebugWorkflowRun) &&
    Array.isArray(value.llmLogs) &&
    value.llmLogs.every(isDebugLlmLog) &&
    Array.isArray(value.qaResults) &&
    value.qaResults.every(isDebugQAResult) &&
    Array.isArray(value.exports) &&
    value.exports.every(isDebugExportRecord)
  );
}

function isDebugWorkflowRun(value: unknown): value is DebugWorkflowRun {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Number.isInteger(value.documentVersion) &&
    typeof value.status === "string" &&
    (typeof value.currentStage === "string" || value.currentStage === null) &&
    Array.isArray(value.completedStages) &&
    value.completedStages.every((stage) => typeof stage === "string") &&
    Array.isArray(value.stageStatuses) &&
    value.stageStatuses.every(isDebugStageStatus) &&
    Array.isArray(value.events) &&
    value.events.every(isDebugWorkflowEvent) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

function isDebugWorkflowEvent(value: unknown): value is DebugWorkflowEvent {
  return isRecord(value) && typeof value.id === "string" && typeof value.eventType === "string" && (typeof value.stage === "string" || value.stage === null) && isRecord(value.payload) && typeof value.createdAt === "string";
}

function isDebugStageStatus(value: unknown): value is DebugStageStatus {
  return isRecord(value) && typeof value.stage === "string" && typeof value.status === "string";
}

function isDebugLlmLog(value: unknown): value is DebugLlmLog {
  return isRecord(value) && typeof value.id === "string" && typeof value.nodeName === "string" && Number.isInteger(value.documentVersion) && typeof value.createdAt === "string";
}

function isDebugQAResult(value: unknown): value is DebugQAResult {
  return isRecord(value) && typeof value.id === "string" && typeof value.generatedSpecId === "string" && Number.isInteger(value.documentVersion) && typeof value.status === "string" && isRecord(value.result) && typeof value.createdAt === "string";
}

function isDebugExportRecord(value: unknown): value is DebugExportRecord {
  return isRecord(value) && typeof value.id === "string" && Number.isInteger(value.documentVersion) && isRecord(value.manifest) && isRecord(value.payload) && typeof value.createdAt === "string";
}

function readApiErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return `Debug history failed with HTTP ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
