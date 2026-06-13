import type { WorkflowRunRecord, WorkflowStage } from "../graph/types.js";
import type { WorkflowRunStore } from "./workflowRuns.js";

const CANCELLATION_REQUESTED_KEY = "cancellationRequested";
const CANCELLATION_REASON_KEY = "cancellationReason";
const CANCELED_INCOMPLETE_STAGE_KEY = "canceledIncompleteStage";

export interface RequestWorkflowCancellationInput {
  reason?: string;
}

export function requestWorkflowCancellation(
  store: WorkflowRunStore,
  runId: string,
  input: RequestWorkflowCancellationInput = {}
): WorkflowRunRecord {
  const run = store.getRun(runId);
  if (!run) {
    throw new Error(`Workflow run ${runId} was not found.`);
  }

  if (isTerminalStatus(run.status)) {
    return run;
  }

  if (run.status === "pending") {
    store.appendEvent(run.id, { eventType: "run_cancel_requested", payload: { reason: input.reason } });
    return markWorkflowCanceled(store, run, {
      incompleteStage: run.currentStage,
      reason: input.reason
    });
  }

  const updated = store.updateRun(run.id, {
    payload: {
      ...run.payload,
      [CANCELLATION_REQUESTED_KEY]: true,
      ...(input.reason ? { [CANCELLATION_REASON_KEY]: input.reason } : {})
    }
  });
  store.appendEvent(run.id, { eventType: "run_cancel_requested", payload: { reason: input.reason }, stage: run.currentStage });
  return updated;
}

export function isWorkflowCancellationRequested(run: WorkflowRunRecord): boolean {
  return run.payload[CANCELLATION_REQUESTED_KEY] === true;
}

export function markWorkflowCanceled(
  store: WorkflowRunStore,
  run: WorkflowRunRecord,
  options: { incompleteStage?: WorkflowStage | null; reason?: string } = {}
): WorkflowRunRecord {
  const reason = options.reason ?? (typeof run.payload[CANCELLATION_REASON_KEY] === "string" ? run.payload[CANCELLATION_REASON_KEY] : undefined);
  const payload = {
    ...run.payload,
    [CANCELLATION_REQUESTED_KEY]: true,
    ...(reason ? { [CANCELLATION_REASON_KEY]: reason } : {}),
    ...(options.incompleteStage ? { [CANCELED_INCOMPLETE_STAGE_KEY]: options.incompleteStage } : {})
  };
  const canceledRun = store.updateRun(run.id, {
    currentStage: options.incompleteStage ?? run.currentStage,
    payload,
    status: "canceled"
  });
  store.appendEvent(run.id, {
    eventType: "run_canceled",
    payload: {
      incompleteStage: options.incompleteStage ?? run.currentStage,
      reason
    },
    stage: options.incompleteStage ?? run.currentStage
  });
  return canceledRun;
}

function isTerminalStatus(status: WorkflowRunRecord["status"]): boolean {
  return status === "completed" || status === "failed" || status === "canceled";
}
