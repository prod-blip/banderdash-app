export const WORKFLOW_STAGES = [
  "Structurer",
  "Analyst",
  "Critic",
  "ConsentDataGap",
  "SpecAgent",
  "Builder",
  "StaticValidator",
  "SandboxQA",
  "Export"
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const WORKFLOW_STATUSES = ["pending", "running", "waiting_for_user", "completed", "failed", "canceled"] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export interface WorkflowRunRecord {
  id: string;
  articleId: string;
  documentVersion: number;
  status: WorkflowStatus;
  currentStage: WorkflowStage | null;
  completedStages: WorkflowStage[];
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowEventRecord {
  id: string;
  workflowRunId: string;
  eventType: WorkflowEventType;
  stage: WorkflowStage | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type WorkflowEventType =
  | "run_started"
  | "stage_started"
  | "stage_completed"
  | "stage_waiting_for_user"
  | "stage_failed"
  | "run_completed"
  | "run_failed"
  | "run_cancel_requested"
  | "run_canceled";

export interface WorkflowStageContext {
  runId: string;
  articleId: string;
  documentVersion: number;
  stage: WorkflowStage;
  payload: Record<string, unknown>;
}

export interface WorkflowStageResult {
  status: "completed" | "waiting_for_user";
  payload?: Record<string, unknown>;
}

export type WorkflowStageHandler = (context: WorkflowStageContext) => Promise<WorkflowStageResult> | WorkflowStageResult;

export type WorkflowStageHandlers = Partial<Record<WorkflowStage, WorkflowStageHandler>>;
