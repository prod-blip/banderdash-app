import { describe, expect, it, vi } from "vitest";
import { canCancelWorkflowRun, cancelWorkflowRun } from "./workflow-cancellation.js";

describe("workflow cancellation UI helpers", () => {
  it("posts a local cancellation request for a workflow run", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ id: "workflow_run_1", status: "canceled" }, 200));

    const result = await cancelWorkflowRun(fetcher, "workflow_run_1");

    expect(fetcher).toHaveBeenCalledWith("/api/workflows/workflow_run_1/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Canceled from local editor UI." })
    });
    expect(result).toEqual({ ok: true, message: "Workflow run workflow_run_1 canceled.", runId: "workflow_run_1", status: "canceled" });
  });

  it("reports API errors without treating the cancel as successful", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ error: { message: "Workflow run missing was not found." } }, 400));

    const result = await cancelWorkflowRun(fetcher, "missing");

    expect(result).toEqual({ ok: false, message: "Workflow run missing was not found.", runId: "missing", status: null });
  });

  it("only enables cancellation for non-terminal run statuses", () => {
    expect(canCancelWorkflowRun("pending")).toBe(true);
    expect(canCancelWorkflowRun("running")).toBe(true);
    expect(canCancelWorkflowRun("waiting_for_user")).toBe(true);
    expect(canCancelWorkflowRun("completed")).toBe(false);
    expect(canCancelWorkflowRun("failed")).toBe(false);
    expect(canCancelWorkflowRun("canceled")).toBe(false);
  });
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
