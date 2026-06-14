import { describe, expect, it, vi } from "vitest";
import type { ArticleDoc } from "@banderdash/doc-model";
import { canExportArticle, createInitialExportPanelState, exportArticle } from "./export-panel.js";

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

describe("export panel helpers", () => {
  it("exports the saved article version with QA override state", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse(
        {
          articleId: article.id,
          documentVersion: article.version,
          exportDir: "/tmp/export_1",
          exportId: "export_1",
          files: [{ bytes: 10, path: "manifest.json", sha256: "a".repeat(64) }],
          previewPath: "/tmp/export_1/preview.html",
          tagName: "ia-article-a1b2c3"
        },
        201
      )
    );
    const state = { ...createInitialExportPanelState(), qaOverrideConfirmed: true };

    const nextState = await exportArticle(fetcher, article, 1, state);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/articles/article-1/exports",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ expectedVersion: 1, qaOverrideConfirmed: true })
      })
    );
    expect(nextState.status).toBe("exported");
    expect(nextState.result?.exportId).toBe("export_1");
  });

  it("requires a saved article and at least one approved candidate", async () => {
    const fetcher = vi.fn();

    expect(canExportArticle(null, 1, "idle")).toBe(false);
    expect(canExportArticle(article, 0, "idle")).toBe(false);
    expect(canExportArticle(article, 1, "exporting")).toBe(false);
    expect(canExportArticle(article, 1, "idle")).toBe(true);

    const noArticle = await exportArticle(fetcher, null, 1, createInitialExportPanelState());
    const noApprovedCandidate = await exportArticle(fetcher, article, 0, createInitialExportPanelState());

    expect(fetcher).not.toHaveBeenCalled();
    expect(noArticle.status).toBe("error");
    expect(noApprovedCandidate.message).toBe("Approve at least one interaction candidate before exporting.");
  });
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
