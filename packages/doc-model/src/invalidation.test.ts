import { describe, expect, it } from "vitest";
import type { Block } from "./types.js";
import { diffInvalidatedBlocks } from "./invalidation.js";

function block(overrides: Partial<Block> & Pick<Block, "id" | "text" | "type">): Block {
  return {
    version: 1,
    spans: [],
    signals: [],
    ...overrides
  };
}

describe("diffInvalidatedBlocks", () => {
  it("retains unchanged blocks by id, type, and text", () => {
    const previous = [block({ id: "block_same", type: "paragraph", text: "Same text." })];
    const next = [block({ id: "block_same", version: 2, type: "paragraph", text: "Same text." })];

    expect(diffInvalidatedBlocks(previous, next)).toEqual({
      invalidatedBlockIds: [],
      retainedBlockIds: ["block_same"]
    });
  });

  it("invalidates changed paragraph blocks", () => {
    const previous = [block({ id: "block_paragraph", type: "paragraph", text: "Old paragraph." })];
    const next = [block({ id: "block_paragraph", version: 2, type: "paragraph", text: "New paragraph." })];

    expect(diffInvalidatedBlocks(previous, next).invalidatedBlockIds).toEqual(["block_paragraph"]);
  });

  it("invalidates changed heading blocks", () => {
    const previous = [block({ id: "block_heading", type: "heading", text: "Old heading" })];
    const next = [block({ id: "block_heading", version: 2, type: "paragraph", text: "Old heading" })];

    expect(diffInvalidatedBlocks(previous, next).invalidatedBlockIds).toEqual(["block_heading"]);
  });

  it("invalidates blocks removed by a parse change", () => {
    const previous = [block({ id: "block_removed", type: "paragraph", text: "Removed." })];
    const next = [block({ id: "block_new", version: 2, type: "paragraph", text: "Replacement." })];

    expect(diffInvalidatedBlocks(previous, next)).toEqual({
      invalidatedBlockIds: ["block_removed"],
      retainedBlockIds: []
    });
  });
});
