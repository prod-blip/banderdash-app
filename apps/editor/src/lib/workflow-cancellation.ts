import type { FetchLike } from "./article-editor";

export interface WorkflowCancellationResult {
  ok: boolean;
  message: string;
  runId: string | null;
  status: string | null;
}

export async function cancelWorkflowRun(fetcher: FetchLike, runId: string): Promise<WorkflowCancellationResult> {
  if (runId.trim().length === 0) {
    return { ok: false, message: "Workflow run id is required.", runId: null, status: null };
  }

  const response = await fetcher(`/api/workflows/${runId}/cancel`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: "Canceled from local editor UI." })
  });
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return { ok: false, message: readApiErrorMessage(payload, response.status), runId, status: null };
  }
  if (!isWorkflowCancellationPayload(payload)) {
    return { ok: false, message: "Cancel API returned an invalid workflow run.", runId, status: null };
  }

  return {
    ok: true,
    message: payload.status === "canceled" ? `Workflow run ${payload.id} canceled.` : `Cancellation requested for workflow run ${payload.id}.`,
    runId: payload.id,
    status: payload.status
  };
}

export function canCancelWorkflowRun(status: string): boolean {
  return status === "pending" || status === "running" || status === "waiting_for_user";
}

function isWorkflowCancellationPayload(value: unknown): value is { id: string; status: string } {
  return isRecord(value) && typeof value.id === "string" && typeof value.status === "string";
}

function readApiErrorMessage(payload: unknown, status: number): string {
  if (isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }

  return `Cancel failed with HTTP ${status}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
