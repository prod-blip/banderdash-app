import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPES,
  SIGNAL_KINDS,
  isArticleDoc,
  isBlock,
  isSignal,
  isSpan,
  type ArticleDoc,
  type Block,
  type Signal,
  type Span
} from "./types.js";

describe("ArticleDoc model", () => {
  it("defines the MVP block and signal vocabularies", () => {
    expect(BLOCK_TYPES).toEqual(["paragraph", "heading", "list", "quote"]);
    expect(SIGNAL_KINDS).toEqual([
      "quantity",
      "comparison",
      "sequence",
      "dataset",
      "causal",
      "geographic",
      "jargon",
      "thematic"
    ]);
  });

  it("validates an ArticleDoc matching the implementation spec", () => {
    const span: Span = { id: "span-1", text: "42%", start: 10, end: 13 };
    const signal: Signal = { spanId: "span-1", kind: "quantity", confidence: 0.82 };
    const block: Block = {
      id: "block-1",
      version: 1,
      type: "paragraph",
      text: "Revenue hit 42% growth.",
      spans: [span],
      signals: [signal]
    };
    const doc: ArticleDoc = {
      id: "article-1",
      version: 1,
      blocks: [block],
      meta: {
        title: "Growth note",
        createdAt: "2026-06-07T00:00:00.000Z",
        updatedAt: "2026-06-07T00:01:00.000Z",
        wordCount: 4
      }
    };

    expect(isSpan(span)).toBe(true);
    expect(isSignal(signal)).toBe(true);
    expect(isBlock(block)).toBe(true);
    expect(isArticleDoc(doc)).toBe(true);
  });

  it("rejects invalid document model values", () => {
    expect(isBlock({ id: "block-1", version: 1, type: "image", text: "x", spans: [], signals: [] })).toBe(false);
    expect(isSpan({ id: "span-1", text: "bad", start: 5, end: 2 })).toBe(false);
    expect(isSignal({ spanId: "span-1", kind: "quantity", confidence: 1.2 })).toBe(false);
    expect(
      isArticleDoc({
        id: "article-1",
        version: 0,
        blocks: [],
        meta: { createdAt: "now", updatedAt: "now", wordCount: -1 }
      })
    ).toBe(false);
  });
});
