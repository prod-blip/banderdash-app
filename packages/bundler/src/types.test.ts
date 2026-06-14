import { describe, expect, it } from "vitest";
import { isExportManifest, validateExportManifest, type ExportManifest } from "./types.js";

const validManifest: ExportManifest = {
  articleId: "article_1",
  componentLibraryVersion: "0.1.0",
  createdAt: "2026-06-14T00:00:00.000Z",
  documentVersion: 3,
  exportId: "export_1",
  files: [
    {
      bytes: 128,
      path: "ia-article-a1b2c3.js",
      sha256: "a".repeat(64)
    },
    {
      bytes: 256,
      path: "manifest.json",
      sha256: "b".repeat(64)
    }
  ],
  interactions: [
    {
      blockIds: ["block_1"],
      componentName: "ReactiveValue",
      id: "candidate_1",
      mode: "library"
    }
  ],
  schemaVersion: "1",
  tagName: "ia-article-a1b2c3"
};

describe("ExportManifest validation", () => {
  it("accepts a complete manifest with required export metadata", () => {
    const result = validateExportManifest(validManifest);

    expect(result).toEqual({ errors: [], ok: true });
    expect(isExportManifest(validManifest)).toBe(true);
  });

  it("rejects missing required top-level fields", () => {
    const incompleteManifest = {
      ...validManifest,
      articleId: "",
      createdAt: "not-a-date",
      documentVersion: 0,
      exportId: undefined,
      files: [],
      tagName: "article"
    };

    expect(validateExportManifest(incompleteManifest)).toEqual({
      errors: [
        "exportId must be a non-empty string",
        "articleId must be a non-empty string",
        "documentVersion must be a positive integer",
        "createdAt must be an ISO date string",
        "tagName must be a valid custom element tag name",
        "files must contain at least one file entry"
      ],
      ok: false
    });
  });

  it("rejects invalid file metadata", () => {
    const manifest = {
      ...validManifest,
      files: [
        {
          bytes: -1,
          path: "",
          sha256: "not-a-sha"
        }
      ]
    };

    expect(validateExportManifest(manifest).errors).toEqual([
      "files[0].path must be a non-empty string",
      "files[0].sha256 must be a lowercase 64-character sha256 hex digest",
      "files[0].bytes must be a positive integer"
    ]);
  });

  it("rejects invalid interaction metadata", () => {
    const manifest = {
      ...validManifest,
      interactions: [
        {
          blockIds: [],
          componentName: "",
          id: "",
          mode: "decorative"
        }
      ]
    };

    expect(validateExportManifest(manifest).errors).toEqual([
      "interactions[0].id must be a non-empty string",
      "interactions[0].blockIds must contain at least one block id",
      "interactions[0].mode must be library or restricted-bespoke",
      "interactions[0].componentName must be a non-empty string when provided"
    ]);
  });
});
