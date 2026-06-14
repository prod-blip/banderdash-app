import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanupExportArtifacts, cleanupTemporaryArtifacts } from "./cleanup.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  for (const directory of tempDirectories.splice(0)) {
    await cleanupTemporaryArtifacts({ paths: [directory] });
  }
});

describe("artifact cleanup", () => {
  it("removes export directories and reports deleted paths", async () => {
    const root = await createTempDirectory();
    const exportDir = join(root, "export_1");
    await mkdir(exportDir);
    await writeFile(join(exportDir, "manifest.json"), "{}", "utf8");

    const result = await cleanupExportArtifacts({ exportDirs: [exportDir, exportDir, ""] });

    expect(result).toEqual({ deletedPaths: [exportDir], failed: [] });
    await expect(stat(exportDir)).rejects.toThrow(/ENOENT/);
  });

  it("removes temporary build artifacts while preserving unrelated files", async () => {
    const root = await createTempDirectory();
    const tempArtifact = join(root, "tmp-build");
    const keepFile = join(root, "keep.txt");
    await mkdir(tempArtifact);
    await writeFile(join(tempArtifact, "bundle.js"), "customElements.define('x-test', class extends HTMLElement {})", "utf8");
    await writeFile(keepFile, "keep", "utf8");

    const result = await cleanupTemporaryArtifacts({ paths: [tempArtifact] });

    expect(result).toEqual({ deletedPaths: [tempArtifact], failed: [] });
    await expect(stat(tempArtifact)).rejects.toThrow(/ENOENT/);
    await expect(readFile(keepFile, "utf8")).resolves.toBe("keep");
  });
});

async function createTempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "banderdash-cleanup-test-"));
  tempDirectories.push(directory);
  return directory;
}
