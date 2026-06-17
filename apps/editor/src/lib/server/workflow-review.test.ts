import { describe, expect, it } from "vitest";
import type { Block } from "@banderdash/doc-model";
import { hasComparisonText } from "./workflow-review.js";

describe("local workflow review comparison detection", () => {
  it("recognizes the manual QA CompareToggle article wording", () => {
    expect(hasComparisonText(block("Local-first exports preserve writer and reader control, while hosted embeds optimize distribution reach."))).toBe(true);
  });

  it("continues to recognize explicit comparison trigger wording", () => {
    expect(hasComparisonText(block("Local-first exports versus hosted embeds changes reader control."))).toBe(true);
    expect(hasComparisonText(block("Local-first exports compared with hosted embeds changes reader control."))).toBe(true);
  });

  it("does not treat ordinary prose as a comparison candidate", () => {
    expect(hasComparisonText(block("Monthly usage doubles from 10 to 20 projects."))).toBe(false);
  });
});

function block(text: string): Block {
  return {
    id: "block-1",
    signals: [],
    spans: [],
    text,
    type: "paragraph",
    version: 1
  };
}
