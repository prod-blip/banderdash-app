import { describe, expect, it, vi } from "vitest";
import type { ArticleDoc } from "@banderdash/doc-model";
import { canLoadDebugHistory, createInitialDebugHistoryState, loadDebugHistory } from "./debug-history.js";

const article: ArticleDoc = {
  id: "article-1",
  version: 2,
  blocks: [],
  meta: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    wordCount: 0
  }
};

describe("debug history UI helpers", () => {
  it("loads debug history for the saved article version", async () => {
    const payload = {
      articleId: article.id,
      documentVersion: article.version,
      workflowRuns: [
        {
          id: "workflow_run_1",
          documentVersion: article.version,
          status: "completed",
          currentStage: null,
          completedStages: ["Analyst"],
          stageStatuses: [{ stage: "Analyst", status: "completed", durationMs: 42 }],
          events: [{ id: "event_1", eventType: "stage_completed", stage: "Analyst", payload: {}, createdAt: "2026-01-01T00:00:00.000Z" }],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:01.000Z"
        }
      ],
      llmLogs: [],
      qaResults: [],
      exports: []
    };
    const fetcher = vi.fn(async () => jsonResponse(payload, 200));

    const nextState = await loadDebugHistory(fetcher, article);

    expect(fetcher).toHaveBeenCalledWith("/api/debug/articles/article-1?version=2");
    expect(nextState.status).toBe("ready");
    expect(nextState.history?.workflowRuns[0]?.stageStatuses[0]).toMatchObject({ stage: "Analyst", durationMs: 42 });
  });

  it("reports empty history when no debug records exist", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ articleId: article.id, documentVersion: article.version, workflowRuns: [], llmLogs: [], qaResults: [], exports: [] }, 200)
    );

    const nextState = await loadDebugHistory(fetcher, article);

    expect(nextState.status).toBe("empty");
    expect(nextState.message).toContain("No workflow history");
  });

  it("prevents loading before an article is saved", async () => {
    const fetcher = vi.fn();

    const nextState = await loadDebugHistory(fetcher, null);

    expect(fetcher).not.toHaveBeenCalled();
    expect(nextState.status).toBe("error");
    expect(canLoadDebugHistory(null, "idle")).toBe(false);
    expect(canLoadDebugHistory(article, "loading")).toBe(false);
    expect(createInitialDebugHistoryState().status).toBe("idle");
  });
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
