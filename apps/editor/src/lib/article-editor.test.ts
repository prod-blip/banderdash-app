import { describe, expect, it, vi } from "vitest";
import type { ArticleDoc } from "@banderdash/doc-model";
import {
  createInitialArticleEditorState,
  getArticleWordCount,
  hasUnsavedArticleChanges,
  persistArticle
} from "./article-editor.js";

const savedArticle: ArticleDoc = {
  id: "article-1",
  version: 1,
  blocks: [
    {
      id: "block-1",
      version: 1,
      type: "paragraph",
      text: "Hello local draft.",
      spans: [],
      signals: []
    }
  ],
  meta: {
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    wordCount: 3
  }
};

describe("article editor state", () => {
  it("counts words and tracks unsaved text", () => {
    const state = createInitialArticleEditorState("Hello local draft");

    expect(getArticleWordCount(state)).toBe(3);
    expect(hasUnsavedArticleChanges(state)).toBe(true);
  });

  it("creates a first saved article through the editor API", async () => {
    const fetcher = vi.fn(async () => jsonResponse(savedArticle, 201));
    const state = createInitialArticleEditorState("Hello local draft.");

    const nextState = await persistArticle(fetcher, state);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/articles",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ rawText: "Hello local draft." })
      })
    );
    expect(nextState.savedArticle?.id).toBe("article-1");
    expect(nextState.status).toBe("saved");
    expect(hasUnsavedArticleChanges(nextState)).toBe(false);
  });

  it("updates an existing article using the latest saved version", async () => {
    const updatedArticle = { ...savedArticle, version: 2 };
    const fetcher = vi.fn(async () => jsonResponse(updatedArticle, 200));
    const state = {
      ...createInitialArticleEditorState("Updated text"),
      savedArticle,
      lastSavedText: "Hello local draft.",
      status: "idle" as const
    };

    const nextState = await persistArticle(fetcher, state);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/articles/article-1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ rawText: "Updated text", expectedVersion: 1 })
      })
    );
    expect(nextState.savedArticle?.version).toBe(2);
    expect(nextState.lastSavedText).toBe("Updated text");
  });

  it("surfaces stale version conflicts without changing the saved article", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({ error: { code: "version_conflict", message: "Reload before updating." } }, 409)
    );
    const state = {
      ...createInitialArticleEditorState("Updated text"),
      savedArticle,
      lastSavedText: "Hello local draft."
    };

    const nextState = await persistArticle(fetcher, state);

    expect(nextState.status).toBe("conflict");
    expect(nextState.message).toBe("Reload before updating.");
    expect(nextState.savedArticle).toBe(savedArticle);
  });
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}
