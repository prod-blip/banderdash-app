import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildExport } from "./buildExport.js";
import { validateExportManifest } from "./types.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  for (const directory of tempDirectories.splice(0)) {
    await rm(directory, { force: true, recursive: true });
  }
});

describe("buildExport", () => {
  it("creates immutable JS, manifest, and preview HTML artifacts with hashes and byte sizes", async () => {
    const outputDir = await createTempDirectory();

    const result = await buildExport({
      article: {
        blocks: [{ id: "block_1", text: "Revenue grew from 10 to 20.", type: "paragraph" }],
        id: "article_1",
        title: "Growth note",
        version: 2
      },
      componentLibraryVersion: "0.1.0",
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      exportId: "export_1",
      interactions: [
        {
          blockIds: ["block_1"],
          componentName: "ReactiveValue",
          fallbackText: "Revenue changes from 10 to 20.",
          id: "candidate_1",
          mode: "library"
        }
      ],
      outputDir
    });

    expect(result.tagName).toMatch(/^ia-article-[a-f0-9]{12}$/);
    expect(result.exportDir).toBe(join(outputDir, "export_1"));
    expect(result.artifacts.map((artifact) => artifact.path).sort()).toEqual(["manifest.json", "preview.html", `${result.tagName}.js`].sort());
    expect(result.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: `${result.tagName}.js`, sha256: expect.stringMatching(/^[a-f0-9]{64}$/), bytes: expect.any(Number) }),
        expect.objectContaining({ path: "manifest.json", sha256: expect.stringMatching(/^[a-f0-9]{64}$/), bytes: expect.any(Number) }),
        expect.objectContaining({ path: "preview.html", sha256: expect.stringMatching(/^[a-f0-9]{64}$/), bytes: expect.any(Number) })
      ])
    );
    expect(result.artifacts.every((artifact) => artifact.bytes > 0)).toBe(true);
    expect(validateExportManifest(result.manifest)).toEqual({ errors: [], ok: true });

    const js = await readFile(join(result.exportDir, `${result.tagName}.js`), "utf8");
    const manifestJson = await readFile(join(result.exportDir, "manifest.json"), "utf8");
    const previewHtml = await readFile(join(result.exportDir, "preview.html"), "utf8");

    expect(js).toContain(`customElements.define("${result.tagName}"`);
    expect(js).not.toContain("sourceMappingURL");
    expect(manifestJson).toContain('"exportId": "export_1"');
    expect(previewHtml).toContain(`data-banderdash-source="${result.tagName}.js"`);
    expect(previewHtml).toContain(`customElements.define("${result.tagName}"`);
    expect(previewHtml).toContain(`<${result.tagName}></${result.tagName}>`);
  });

  it("uses a distinct immutable directory per export id and refuses to overwrite an existing export", async () => {
    const outputDir = await createTempDirectory();
    const input = createBuildInput(outputDir, "export_1");
    const first = await buildExport(input);
    const second = await buildExport(createBuildInput(outputDir, "export_2"));

    expect(first.exportDir).not.toBe(second.exportDir);
    await expect(buildExport(input)).rejects.toThrow(/EEXIST/);
  });
});

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "banderdash-export-test-"));
  tempDirectories.push(directory);
  return directory;
}

function createBuildInput(outputDir: string, exportId: string) {
  return {
    article: {
      blocks: [{ id: "block_1", text: "Revenue grew from 10 to 20.", type: "paragraph" }],
      id: "article_1",
      version: 1
    },
    componentLibraryVersion: "0.1.0",
    createdAt: new Date("2026-06-14T00:00:00.000Z"),
    exportId,
    interactions: [
      {
        blockIds: ["block_1"],
        componentName: "ReactiveValue",
        fallbackText: "Revenue changes from 10 to 20.",
        id: "candidate_1",
        mode: "library" as const
      }
    ],
    outputDir
  };
}
