import { WORKFLOW_STAGES, type WorkflowStage, type WorkflowStageHandlers, type WorkflowStageResult } from "./types.js";
import { isWorkflowCancellationRequested, markWorkflowCanceled } from "../services/cancellation.js";
import type { WorkflowRunStore } from "../services/workflowRuns.js";

export interface WorkflowRunnerOptions {
  handlers: WorkflowStageHandlers;
  store: WorkflowRunStore;
  stages?: readonly WorkflowStage[];
}

export interface StartWorkflowRunInput {
  articleId: string;
  documentVersion: number;
  payload?: Record<string, unknown>;
}

export interface ResumeWorkflowRunInput {
  runId: string;
}

export async function startWorkflowRun(options: WorkflowRunnerOptions, input: StartWorkflowRunInput) {
  const run = options.store.createRun({ articleId: input.articleId, documentVersion: input.documentVersion, payload: input.payload });
  options.store.appendEvent(run.id, { eventType: "run_started", payload: { articleId: run.articleId, documentVersion: run.documentVersion } });
  return executeWorkflowRun(options, run.id);
}

export async function resumeWorkflowRun(options: WorkflowRunnerOptions, input: ResumeWorkflowRunInput) {
  const run = options.store.getRun(input.runId);
  if (!run) {
    throw new Error(`Workflow run ${input.runId} was not found.`);
  }

  if (run.status === "completed" || run.status === "failed" || run.status === "canceled") {
    return run;
  }

  return executeWorkflowRun(options, input.runId);
}

async function executeWorkflowRun(options: WorkflowRunnerOptions, runId: string) {
  const stages = options.stages ?? WORKFLOW_STAGES;
  let run = options.store.getRun(runId);
  if (!run) {
    throw new Error(`Workflow run ${runId} was not found.`);
  }

  const startIndex = nextStageIndex(stages, run.completedStages);
  for (const stage of stages.slice(startIndex)) {
    if (isWorkflowCancellationRequested(run)) {
      return markWorkflowCanceled(options.store, run, { incompleteStage: stage });
    }

    const handler = options.handlers[stage] ?? defaultStageHandler;
    run = options.store.updateRun(run.id, { currentStage: stage, status: "running" });
    options.store.appendEvent(run.id, { eventType: "stage_started", stage });

    try {
      const result = await handler({
        runId: run.id,
        articleId: run.articleId,
        documentVersion: run.documentVersion,
        stage,
        payload: run.payload
      });

      const cancellationCheck = options.store.getRun(run.id);
      if (cancellationCheck && isWorkflowCancellationRequested(cancellationCheck)) {
        return markWorkflowCanceled(options.store, cancellationCheck, { incompleteStage: stage });
      }

      const nextPayload = { ...run.payload, ...(result.payload ?? {}) };

      if (result.status === "waiting_for_user") {
        run = options.store.updateRun(run.id, { currentStage: stage, payload: nextPayload, status: "waiting_for_user" });
        options.store.appendEvent(run.id, { eventType: "stage_waiting_for_user", payload: result.payload, stage });
        return run;
      }

      run = options.store.updateRun(run.id, {
        completedStages: [...run.completedStages, stage],
        currentStage: null,
        payload: nextPayload,
        status: "running"
      });
      options.store.appendEvent(run.id, { eventType: "stage_completed", payload: result.payload, stage });
    } catch (error) {
      run = options.store.updateRun(run.id, {
        currentStage: stage,
        payload: { ...run.payload, error: errorMessage(error) },
        status: "failed"
      });
      options.store.appendEvent(run.id, { eventType: "stage_failed", payload: { error: errorMessage(error) }, stage });
      options.store.appendEvent(run.id, { eventType: "run_failed", payload: { error: errorMessage(error) } });
      return run;
    }
  }

  run = options.store.updateRun(run.id, { currentStage: null, status: "completed" });
  options.store.appendEvent(run.id, { eventType: "run_completed" });
  return run;
}

function nextStageIndex(stages: readonly WorkflowStage[], completedStages: WorkflowStage[]): number {
  if (completedStages.length === 0) {
    return 0;
  }

  const lastCompleted = completedStages[completedStages.length - 1];
  const index = stages.indexOf(lastCompleted);
  return index === -1 ? 0 : index + 1;
}

function defaultStageHandler(): WorkflowStageResult {
  return { status: "completed" as const };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
