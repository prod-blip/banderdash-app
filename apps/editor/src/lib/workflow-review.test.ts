import { describe, expect, it, vi } from "vitest";
import type { ArticleDoc } from "@banderdash/doc-model";
import type { InteractionCandidate } from "@banderdash/backend/nodes/schemas/candidate";
import {
  canRunCandidateReview,
  createInitialWorkflowReviewState,
  recordCandidateConsent,
  runCandidateReview
} from "./workflow-review.js";

const article: ArticleDoc = {
  id: "article-1",
  version: 1,
  blocks: [
    {
      id: "block-1",
      version: 1,
      type: "paragraph",
      text: "Revenue grew from 10 to 20.",
      spans: [],
      signals: []
    }
  ],
  meta: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    wordCount: 5
  }
};

const candidate: InteractionCandidate = {
  id: "candidate-1",
  articleId: article.id,
  documentVersion: article.version,
  blockIds: ["block-1"],
  spanIds: [],
  pattern: "ReactiveValue",
  rationale: "The block contains a numeric relationship.",
  requiredData: [],
  libraryRepresentable: true,
  understandingLossIfRemoved: "Readers lose the ability to test the numeric relationship.",
  status: "survived"
};

describe("workflow review UI helpers", () => {
  it("runs candidate review for the saved article version", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        {
          articleId: article.id,
          candidates: [candidate],
          documentVersion: article.version,
          mode: "local-fake-provider"
        },
        200
      )
    );

    const nextState = await runCandidateReview(fetcher, article, createInitialWorkflowReviewState());

    expect(fetcher).toHaveBeenCalledWith(
      "/api/articles/article-1/candidate-review",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ expectedVersion: 1 }) })
    );
    expect(nextState.status).toBe("ready");
    expect(nextState.candidates).toHaveLength(1);
    expect(nextState.candidates[0]?.blockIds).toEqual(["block-1"]);
  });

  it("records writer consent for a candidate", async () => {
    const fetcher = vi.fn(async () => jsonResponse({ id: "approval-1" }, 201));
    const state = { ...createInitialWorkflowReviewState(), candidates: [candidate] };

    const nextState = await recordCandidateConsent(fetcher, article, state, candidate.id, "approved");

    expect(fetcher).toHaveBeenCalledWith(
      "/api/articles/article-1/approvals",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ candidateId: candidate.id, decision: "approved", expectedVersion: 1 })
      })
    );
    expect(nextState.consentByCandidateId[candidate.id]).toBe("approved");
  });

  it("prevents candidate review before an article is saved", async () => {
    const fetcher = vi.fn();

    const nextState = await runCandidateReview(fetcher, null, createInitialWorkflowReviewState());

    expect(fetcher).not.toHaveBeenCalled();
    expect(nextState.status).toBe("error");
    expect(canRunCandidateReview(null, "idle")).toBe(false);
  });
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
