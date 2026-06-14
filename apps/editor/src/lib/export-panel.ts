import type { ArticleDoc } from "@banderdash/doc-model";
import type { FetchLike } from "./article-editor";

export type ExportStatus = "idle" | "exporting" | "exported" | "error";

export interface ExportArtifactSummary {
  path: string;
  bytes: number;
  sha256: string;
}

export interface ExportResult {
  exportId: string;
  articleId: string;
  documentVersion: number;
  tagName: string;
  exportDir: string;
  previewPath: string;
  files: ExportArtifactSummary[];
}

export interface ExportPanelState {
  status: ExportStatus;
  message: string;
  result: ExportResult | null;
  qaOverrideConfirmed: boolean;
}

export function createInitialExportPanelState(): ExportPanelState {
  return {
    status: "idle",
    message: "Approve at least one candidate, then export an immutable local artifact.",
    result: null,
    qaOverrideConfirmed: false
  };
}

export function canExportArticle(article: ArticleDoc | null, approvedCandidateCount: number, status: ExportStatus): boolean {
  return Boolean(article) && approvedCandidateCount > 0 && status !== "exporting";
}

export async function exportArticle(
  fetcher: FetchLike,
  article: ArticleDoc | null,
  approvedCandidateCount: number,
  state: ExportPanelState
): Promise<ExportPanelState> {
  if (!article) {
    return { ...state, status: "error", message: "Save an article before exporting." };
  }
  if (approvedCandidateCount === 0) {
    return { ...state, status: "error", message: "Approve at least one interaction candidate before exporting." };
  }

  const response = await fetcher(`/api/articles/${article.id}/exports`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedVersion: article.version, qaOverrideConfirmed: state.qaOverrideConfirmed })
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return { ...state, status: "error", message: readApiErrorMessage(payload, response.status) };
  }
  if (!isExportResult(payload)) {
    return { ...state, status: "error", message: "Export API returned an invalid response." };
  }

  return {
    ...state,
    status: "exported",
    message: `Export ${payload.exportId} created with ${payload.files.length} file${payload.files.length === 1 ? "" : "s"}.`,
    result: payload
  };
}

function isExportResult(value: unknown): value is ExportResult {
  return (
    isRecord(value) &&
    typeof value.exportId === "string" &&
    typeof value.articleId === "string" &&
    Number.isInteger(value.documentVersion) &&
    typeof value.tagName === "string" &&
    typeof value.exportDir === "string" &&
    typeof value.previewPath === "string" &&
    Array.isArray(value.files) &&
    value.files.every(isExportArtifactSummary)
  );
}

function isExportArtifactSummary(value: unknown): value is ExportArtifactSummary {
  return isRecord(value) && typeof value.path === "string" && Number.isInteger(value.bytes) && typeof value.sha256 === "string";
}

function readApiErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return `Export failed with HTTP ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
