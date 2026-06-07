import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { connectDatabase, type BanderdashDatabase } from "./db.js";
import { runMigrations } from "./migrations.js";
import { ArticleNotFoundError, ArticleVersionConflictError, createArticleService } from "./articles.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-articles-test-"));
  tempDirectories.push(directory);
  return join(directory, "state", "banderdash.sqlite");
}

function createMigratedDatabase(): BanderdashDatabase {
  const db = connectDatabase({ sqlitePath: createTempDatabasePath() });
  runMigrations(db);
  return db;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("article persistence service", () => {
  it("creates a persisted article document from raw text", async () => {
    const db = createMigratedDatabase();
    const service = createArticleService({
      createId: () => "article_test_1",
      db,
      now: () => new Date("2026-06-07T00:00:00.000Z")
    });

    try {
      const article = await service.createArticle("# Test Article\n\nA useful paragraph.");

      expect(article).toMatchObject({
        id: "article_test_1",
        version: 1,
        meta: {
          createdAt: "2026-06-07T00:00:00.000Z",
          updatedAt: "2026-06-07T00:00:00.000Z",
          wordCount: 5
        }
      });
      expect(article.blocks.map((block) => [block.version, block.type, block.text])).toEqual([
        [1, "heading", "Test Article"],
        [1, "paragraph", "A useful paragraph."]
      ]);

      const rows = db
        .prepare("select id, current_version from articles where id = ?")
        .all(article.id) as Array<{ current_version: number; id: string }>;
      expect(rows).toEqual([{ current_version: 1, id: "article_test_1" }]);
    } finally {
      db.close();
    }
  });

  it("updates an article by creating a new persisted version", async () => {
    const db = createMigratedDatabase();
    let idCounter = 0;
    let clockTick = 0;
    const service = createArticleService({
      createId: () => `article_test_${++idCounter}`,
      db,
      now: () => new Date(clockTick++ === 0 ? "2026-06-07T00:00:00.000Z" : "2026-06-07T00:01:00.000Z")
    });

    try {
      const first = await service.createArticle("First paragraph.");
      const second = await service.updateArticle(first.id, "First paragraph.\n\nSecond paragraph.", 1);

      expect(second.id).toBe(first.id);
      expect(second.version).toBe(2);
      expect(second.meta.createdAt).toBe("2026-06-07T00:00:00.000Z");
      expect(second.meta.updatedAt).toBe("2026-06-07T00:01:00.000Z");
      expect(second.blocks.map((block) => [block.version, block.type, block.text])).toEqual([
        [2, "paragraph", "First paragraph."],
        [2, "paragraph", "Second paragraph."]
      ]);

      const versions = db
        .prepare("select version from article_versions where article_id = ? order by version")
        .all(first.id) as Array<{ version: number }>;
      expect(versions).toEqual([{ version: 1 }, { version: 2 }]);
    } finally {
      db.close();
    }
  });

  it("loads the latest materialized article document", async () => {
    const db = createMigratedDatabase();
    const service = createArticleService({
      createId: () => "article_test_1",
      db,
      now: () => new Date("2026-06-07T00:00:00.000Z")
    });

    try {
      const created = await service.createArticle("Old text.");
      const updated = await service.updateArticle(created.id, "# New Title\n\nNew text.", 1);

      await expect(service.getArticle(created.id)).resolves.toEqual(updated);
    } finally {
      db.close();
    }
  });

  it("rejects article text over the MVP word limit", async () => {
    const db = createMigratedDatabase();
    const service = createArticleService({
      createId: () => "article_test_1",
      db,
      now: () => new Date("2026-06-07T00:00:00.000Z")
    });
    const tooLong = Array.from({ length: 5_001 }, (_, index) => `word${index}`).join(" ");

    try {
      await expect(service.createArticle(tooLong)).rejects.toThrow(
        "Article is 5,001 words; the MVP limit is 5,000 words."
      );
    } finally {
      db.close();
    }
  });

  it("rejects updates with a stale expected version", async () => {
    const db = createMigratedDatabase();
    const service = createArticleService({
      createId: () => "article_test_1",
      db,
      now: () => new Date("2026-06-07T00:00:00.000Z")
    });

    try {
      const article = await service.createArticle("Current text.");

      await expect(service.updateArticle(article.id, "Replacement text.", 0)).rejects.toBeInstanceOf(
        ArticleVersionConflictError
      );
    } finally {
      db.close();
    }
  });

  it("rejects loading a missing article", async () => {
    const db = createMigratedDatabase();
    const service = createArticleService({
      createId: () => "article_test_1",
      db,
      now: () => new Date("2026-06-07T00:00:00.000Z")
    });

    try {
      await expect(service.getArticle("missing_article")).rejects.toBeInstanceOf(ArticleNotFoundError);
    } finally {
      db.close();
    }
  });
});
