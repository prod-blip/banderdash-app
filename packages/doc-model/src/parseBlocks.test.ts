import { describe, expect, it } from "vitest";
import { parseBlocks } from "./parseBlocks.js";

describe("parseBlocks", () => {
  it("parses paragraphs, headings, lists, and quotes from pasted prose", () => {
    const blocks = parseBlocks([
      "# Market shift",
      "",
      "Revenue grew 42% year-over-year.",
      "",
      "- Lower acquisition cost",
      "- Better retention",
      "",
      "> The key question is durability."
    ].join("\n"));

    expect(blocks).toMatchObject([
      { version: 1, type: "heading", text: "Market shift", spans: [], signals: [] },
      { version: 1, type: "paragraph", text: "Revenue grew 42% year-over-year.", spans: [], signals: [] },
      { version: 1, type: "list", text: "Lower acquisition cost\nBetter retention", spans: [], signals: [] },
      { version: 1, type: "quote", text: "The key question is durability.", spans: [], signals: [] }
    ]);
    expect(blocks.map((block) => block.id)).toHaveLength(4);
    expect(new Set(blocks.map((block) => block.id)).size).toBe(4);
  });

  it("uses stable block IDs for the same content", () => {
    const first = parseBlocks("# Same title\n\nSame paragraph");
    const second = parseBlocks("# Same title\n\nSame paragraph");

    expect(second.map((block) => block.id)).toEqual(first.map((block) => block.id));
  });

  it("supports explicit document versions", () => {
    const [block] = parseBlocks("Versioned paragraph", { version: 3 });

    expect(block?.version).toBe(3);
  });

  it("rejects pasted prose over the MVP word limit", () => {
    const text = Array.from({ length: 5001 }, (_, index) => `word${index}`).join(" ");

    expect(() => parseBlocks(text)).toThrow("Article is 5,001 words; the MVP limit is 5,000 words.");
  });
});
