import type { BanderdashDatabase } from "./db.js";
import type { WorkflowStage } from "../graph/types.js";

export interface TokenUsageMetadata {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface CostMetadata {
  currency: string;
  total: number;
}

export interface CreateLlmLogStoreOptions {
  createId?: (prefix: "llm_log") => string;
  db: BanderdashDatabase;
  now?: () => Date;
}

export interface RecordLlmLogInput {
  articleId: string;
  cost?: CostMetadata;
  documentVersion: number;
  durationMs?: number;
  error?: Record<string, unknown>;
  model?: string;
  nodeName: WorkflowStage | string;
  provider?: string;
  structuredInput?: Record<string, unknown>;
  structuredOutput?: Record<string, unknown>;
  tokenUsage?: TokenUsageMetadata;
  workflowRunId?: string | null;
}

export interface LlmLogRecord {
  articleId: string;
  cost?: CostMetadata;
  createdAt: string;
  documentVersion: number;
  durationMs?: number;
  error?: Record<string, unknown>;
  id: string;
  model: string | null;
  nodeName: string;
  provider: string | null;
  structuredInput?: Record<string, unknown>;
  structuredOutput?: Record<string, unknown>;
  tokenUsage?: TokenUsageMetadata;
  workflowRunId: string | null;
}

export interface LlmLogStore {
  listForRun(workflowRunId: string): LlmLogRecord[];
  recordLog(input: RecordLlmLogInput): LlmLogRecord;
}

const FORBIDDEN_RAW_DUMP_KEYS = new Set(["rawProviderRequest", "rawProviderResponse", "rawRequest", "rawResponse"]);

export function createLlmLogStore(options: CreateLlmLogStoreOptions): LlmLogStore {
  const createId = options.createId ?? defaultCreateId;
  const now = options.now ?? (() => new Date());

  return {
    listForRun(workflowRunId) {
      const rows = options.db
        .prepare(
          `select id, workflow_run_id, article_id, document_version, provider, model, payload_json, created_at
            from llm_logs
            where workflow_run_id = ?
            order by created_at, id`
        )
        .all(workflowRunId) as unknown as LlmLogRow[];

      return rows.map(rowToLog);
    },

    recordLog(input) {
      assertSafeStructuredPayload("structuredInput", input.structuredInput);
      assertSafeStructuredPayload("structuredOutput", input.structuredOutput);
      assertSafeStructuredPayload("error", input.error);

      const timestamp = now().toISOString();
      const record: LlmLogRecord = {
        articleId: input.articleId,
        cost: input.cost,
        createdAt: timestamp,
        documentVersion: input.documentVersion,
        durationMs: input.durationMs,
        error: input.error,
        id: createId("llm_log"),
        model: input.model ?? null,
        nodeName: input.nodeName,
        provider: input.provider ?? null,
        structuredInput: input.structuredInput,
        structuredOutput: input.structuredOutput,
        tokenUsage: normalizeTokenUsage(input.tokenUsage),
        workflowRunId: input.workflowRunId ?? null
      };

      options.db
        .prepare(
          `insert into llm_logs (id, workflow_run_id, article_id, document_version, provider, model, payload_json, created_at)
            values (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          record.id,
          record.workflowRunId,
          record.articleId,
          record.documentVersion,
          record.provider,
          record.model,
          serializeLogPayload(record),
          record.createdAt
        );

      return record;
    }
  };
}

function serializeLogPayload(record: LlmLogRecord): string {
  return JSON.stringify({
    cost: record.cost,
    durationMs: record.durationMs,
    error: record.error,
    nodeName: record.nodeName,
    structuredInput: record.structuredInput,
    structuredOutput: record.structuredOutput,
    tokenUsage: record.tokenUsage
  });
}

function rowToLog(row: LlmLogRow): LlmLogRecord {
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
}

function normalizeTokenUsage(value: TokenUsageMetadata | undefined): TokenUsageMetadata | undefined {
  if (!value) {
    return undefined;
  }

  const output: TokenUsageMetadata = {};
  if (typeof value.inputTokens === "number") output.inputTokens = value.inputTokens;
  if (typeof value.outputTokens === "number") output.outputTokens = value.outputTokens;
  if (typeof value.totalTokens === "number") output.totalTokens = value.totalTokens;
  return Object.keys(output).length > 0 ? output : undefined;
}

function assertSafeStructuredPayload(label: string, value: unknown): void {
  const forbiddenPath = findForbiddenRawDumpPath(value);
  if (forbiddenPath) {
    throw new Error(`${label} contains forbidden raw provider dump field: ${forbiddenPath}`);
  }
}

function findForbiddenRawDumpPath(value: unknown, path = ""): string | null {
  if (!isRecord(value)) {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_RAW_DUMP_KEYS.has(key)) {
      return currentPath;
    }

    const nestedPath = findForbiddenRawDumpPath(nestedValue, currentPath);
    if (nestedPath) {
      return nestedPath;
    }
  }

  return null;
}

function parseJsonRecord(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  return isRecord(parsed) ? parsed : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTokenUsageMetadata(value: unknown): value is TokenUsageMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return ["inputTokens", "outputTokens", "totalTokens"].some((key) => typeof value[key] === "number");
}

function isCostMetadata(value: unknown): value is CostMetadata {
  return isRecord(value) && typeof value.currency === "string" && typeof value.total === "number";
}

function defaultCreateId(): string {
  return `llm_log_${crypto.randomUUID()}`;
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
