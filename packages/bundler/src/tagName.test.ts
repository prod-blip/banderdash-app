import { describe, expect, it } from "vitest";
import { generateExportTagName, isValidCustomElementTagName } from "./tagName.js";
import { validateExportManifest, type ExportManifest } from "./types.js";

describe("export custom element tag names", () => {
  it("generates tags with the required ia-article prefix", () => {
    expect(generateExportTagName({ exportId: "export_1" })).toMatch(/^ia-article-[a-f0-9]{12}$/);
  });

  it("generates valid custom element names", () => {
    const tagName = generateExportTagName({ exportId: "export_1" });

    expect(isValidCustomElementTagName(tagName)).toBe(true);
    expect(validateExportManifest(createManifest(tagName))).toEqual({ errors: [], ok: true });
  });

  it("generates stable tags for the same export id", () => {
    expect(generateExportTagName({ exportId: "export_1" })).toBe(generateExportTagName({ exportId: "export_1" }));
  });

  it("generates different tags for repeated exports", () => {
    const first = generateExportTagName({ exportId: "export_1" });
    const second = generateExportTagName({ exportId: "export_2" });

    expect(first).not.toBe(second);
  });
});

function createManifest(tagName: string): ExportManifest {
  return {
    articleId: "article_1",
    componentLibraryVersion: "0.1.0",
    createdAt: "2026-06-14T00:00:00.000Z",
    documentVersion: 1,
    exportId: "export_1",
    files: [
      {
        bytes: 128,
        path: `${tagName}.js`,
        sha256: "a".repeat(64)
      }
    ],
    interactions: [],
    schemaVersion: "1",
    tagName
  };
}
