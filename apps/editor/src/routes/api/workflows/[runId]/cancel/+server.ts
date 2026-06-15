import { requestWorkflowCancellation } from "@banderdash/backend/services/cancellation";
import { createWorkflowRunStore } from "@banderdash/backend/services/workflowRuns";
import { json, type RequestHandler } from "@sveltejs/kit";
import { getEditorDatabase } from "$lib/server/article-service";

export const POST: RequestHandler = async ({ params, request }) => {
  const runId = (params as Record<string, string | undefined>).runId;
  if (!runId) {
    return json({ error: { code: "invalid_request", message: "Workflow run id is required." } }, { status: 400 });
  }

  try {
    const requestBody = (await request.json().catch(() => ({}))) as unknown;
    const reason = readCancellationReason(requestBody);
    const store = createWorkflowRunStore({ db: getEditorDatabase() });
    const canceledRun = requestWorkflowCancellation(store, runId, { reason });

    return json(canceledRun);
  } catch (error) {
    return json({ error: { code: "workflow_cancel_failed", message: formatErrorMessage(error) } }, { status: 400 });
  }
};

function readCancellationReason(value: unknown): string | undefined {
  if (!isRecord(value) || value.reason === undefined) {
    return undefined;
  }
  if (typeof value.reason !== "string") {
    throw new Error("Cancellation reason must be a string when provided.");
  }

  const trimmedReason = value.reason.trim();
  return trimmedReason.length > 0 ? trimmedReason : undefined;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
