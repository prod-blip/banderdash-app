import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createArticleService } from "./articles.js";
import { connectDatabase, type BanderdashDatabase } from "./db.js";
import { cleanupOldExportArtifacts } from "./exports.js";
import { runMigrations } from "./migrations.js";

const tempDirectories: string[] = [];

function createTempDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  tempDirectories.push(directory);
  return directory;
}

function createMigratedDatabase(): BanderdashDatabase {
  const db = connectDatabase({ sqlitePath: join(createTempDirectory("banderdash-export-cleanup-db-"), "state", "banderdash.sqlite") });
  runMigrations(db);
  return db;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("export artifact cleanup", () => {
  it("keeps the latest completed exports per article and removes only older artifact directories", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });
    const exportRoot = createTempDirectory("banderdash-export-cleanup-output-");

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const exportDirs = Array.from({ length: 12 }, (_, index) => createExportFixture(db, exportRoot, article.id, index + 1));

      const result = await cleanupOldExportArtifacts({ articleId: article.id, db, keepLatest: 10 });

      expect(result.deletedExportIds).toEqual(["export_2", "export_1"]);
      expect(result.artifactCleanup.failed).toEqual([]);
      expect(result.artifactCleanup.deletedPaths).toEqual([exportDirs[1], exportDirs[0]]);
      await expect(stat(exportDirs[0]!)).rejects.toThrow(/ENOENT/);
      await expect(stat(exportDirs[1]!)).rejects.toThrow(/ENOENT/);
      await expect(stat(exportDirs[2]!)).resolves.toMatchObject({ isDirectory: expect.any(Function) });
      expect(readExportIds(db)).toHaveLength(12);
    } finally {
      db.close();
    }
  });

  it("does not clean exports belonging to a different article", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({
      createId: (() => {
        let next = 1;
        return () => `article_test_${next++}`;
      })(),
      db
    });
    const exportRoot = createTempDirectory("banderdash-export-cleanup-output-");

    try {
      const article = await articleService.createArticle("Article one.");
      const otherArticle = await articleService.createArticle("Article two.");
      const oldDir = createExportFixture(db, exportRoot, article.id, 1);
      const otherDir = createExportFixture(db, exportRoot, otherArticle.id, 101);

      const result = await cleanupOldExportArtifacts({ articleId: article.id, db, keepLatest: 1 });

      expect(result.deletedExportIds).toEqual([]);
      await expect(stat(oldDir)).resolves.toMatchObject({ isDirectory: expect.any(Function) });
      await expect(stat(otherDir)).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    } finally {
      db.close();
    }
  });

  it("rejects invalid retention limits", async () => {
    const db = createMigratedDatabase();
    try {
      await expect(cleanupOldExportArtifacts({ articleId: "article_1", db, keepLatest: 0 })).rejects.toThrow("keepLatest must be a positive integer");
    } finally {
      db.close();
    }
  });
});

function createExportFixture(db: BanderdashDatabase, exportRoot: string, articleId: string, sequence: number): string {
  const exportId = `export_${sequence}`;
  const exportDir = join(exportRoot, exportId);
  mkdirSync(exportDir);
  writeFileSync(join(exportDir, "manifest.json"), "{}", "utf8");

  const manifest = {
    articleId,
    componentLibraryVersion: "0.1.0",
    createdAt: `2026-06-14T00:${String(sequence).padStart(2, "0")}:00.000Z`,
    documentVersion: 1,
    exportId,
    files: [{ bytes: 2, path: "manifest.json", sha256: "a".repeat(64) }],
    interactions: [],
    schemaVersion: "1",
    tagName: `ia-article-${String(sequence).padStart(2, "0")}`
  };
  const payload = { artifacts: [], exportDir, tagName: manifest.tagName };

  db.prepare(
    `insert into exports (id, article_id, document_version, manifest_json, payload_json, created_at)
      values (?, ?, ?, ?, ?, ?)`
  ).run(exportId, articleId, 1, JSON.stringify(manifest), JSON.stringify(payload), manifest.createdAt);

  return exportDir;
}

function readExportIds(db: BanderdashDatabase): string[] {
  return (db.prepare("select id from exports order by created_at asc").all() as Array<{ id: string }>).map((row) => row.id);
}
