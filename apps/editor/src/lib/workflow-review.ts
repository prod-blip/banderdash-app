import type { InteractionCandidate } from "@banderdash/backend/nodes/schemas/candidate";
import type { ArticleDoc } from "@banderdash/doc-model";
import type { FetchLike } from "./article-editor";

export type WorkflowReviewStatus = "idle" | "running" | "ready" | "error";
export type ConsentDecision = "approved" | "rejected";

export interface WorkflowReviewState {
  status: WorkflowReviewStatus;
  message: string;
  candidates: InteractionCandidate[];
  consentByCandidateId: Record<string, ConsentDecision>;
}

export interface CandidateReviewResponse {
  articleId: string;
  documentVersion: number;
  candidates: InteractionCandidate[];
  mode: "local-fake-provider";
}

export function createInitialWorkflowReviewState(): WorkflowReviewState {
  return {
    status: "idle",
    message: "Save an article, then run local analysis to review interaction candidates.",
    candidates: [],
    consentByCandidateId: {}
  };
}

export function canRunCandidateReview(article: ArticleDoc | null, status: WorkflowReviewStatus): boolean {
  return Boolean(article) && status !== "running";
}

export async function runCandidateReview(
  fetcher: FetchLike,
  article: ArticleDoc | null,
  state: WorkflowReviewState
): Promise<WorkflowReviewState> {
  if (!article) {
    return { ...state, status: "error", message: "Save an article before running analysis." };
  }

  const response = await fetcher(`/api/articles/${article.id}/candidate-review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedVersion: article.version })
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return { ...state, status: "error", message: readApiErrorMessage(payload, response.status) };
  }
  if (!isCandidateReviewResponse(payload)) {
    return { ...state, status: "error", message: "Candidate review API returned an invalid response." };
  }

  return {
    status: "ready",
    message:
      payload.candidates.length === 0
        ? "No numeric interaction candidates survived local analysis for this draft."
        : `Found ${payload.candidates.length} candidate${payload.candidates.length === 1 ? "" : "s"} ready for writer consent.`,
    candidates: payload.candidates,
    consentByCandidateId: {}
  };
}

export async function recordCandidateConsent(
  fetcher: FetchLike,
  article: ArticleDoc | null,
  state: WorkflowReviewState,
  candidateId: string,
  decision: ConsentDecision
): Promise<WorkflowReviewState> {
  if (!article) {
    return { ...state, status: "error", message: "Save an article before approving candidates." };
  }

  const response = await fetcher(`/api/articles/${article.id}/approvals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ candidateId, decision, expectedVersion: article.version })
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return { ...state, status: "error", message: readApiErrorMessage(payload, response.status) };
  }

  return {
    ...state,
    status: "ready",
    message: `Candidate ${decision}.`,
    consentByCandidateId: {
      ...state.consentByCandidateId,
      [candidateId]: decision
    }
  };
}

function isCandidateReviewResponse(value: unknown): value is CandidateReviewResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.articleId === "string" &&
    Number.isInteger(value.documentVersion) &&
    value.mode === "local-fake-provider" &&
    Array.isArray(value.candidates) &&
    value.candidates.every(isInteractionCandidateLike)
  );
}

function isInteractionCandidateLike(value: unknown): value is InteractionCandidate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.articleId === "string" &&
    Number.isInteger(value.documentVersion) &&
    Array.isArray(value.blockIds) &&
    typeof value.pattern === "string" &&
    typeof value.rationale === "string" &&
    typeof value.understandingLossIfRemoved === "string" &&
    typeof value.status === "string"
  );
}

function readApiErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return `Candidate review failed with HTTP ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
