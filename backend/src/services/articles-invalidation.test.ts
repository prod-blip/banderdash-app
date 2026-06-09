import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { connectDatabase, type BanderdashDatabase } from "./db.js";
import { runMigrations } from "./migrations.js";
import { ArticleVersionConflictError, createArticleService } from "./articles.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-invalidation-test-"));
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

describe("article invalidation", () => {
  it("invalidates generated state tied to changed blocks and retains unchanged block state", async () => {
    const db = createMigratedDatabase();
    let clockTick = 0;
    const service = createArticleService({
      createId: () => "article_invalidation_1",
      db,
      now: () => new Date(clockTick++ === 0 ? "2026-06-07T00:00:00.000Z" : "2026-06-07T00:01:00.000Z")
    });

    try {
      const first = await service.createArticle("# Stable heading\n\nOld paragraph.");
      const [retainedBlock, changedBlock] = first.blocks;
      if (!retainedBlock || !changedBlock) {
        throw new Error("expected test article blocks");
      }

      insertGeneratedState(db, {
        articleId: first.id,
        blockId: retainedBlock.id,
        candidateId: "candidate_retained",
        specId: "spec_retained",
        exportId: "export_retained"
      });
      insertGeneratedState(db, {
        articleId: first.id,
        blockId: changedBlock.id,
        candidateId: "candidate_changed",
        specId: "spec_changed",
        exportId: "export_changed"
      });

      await service.updateArticle(first.id, "# Stable heading\n\nNew paragraph.", 1);

      expect(readInvalidatedAt(db, "candidates", "candidate_changed")).toBe("2026-06-07T00:01:00.000Z");
      expect(readInvalidatedAt(db, "approvals", "approval_candidate_changed")).toBe("2026-06-07T00:01:00.000Z");
      expect(readInvalidatedAt(db, "generated_specs", "spec_changed")).toBe("2026-06-07T00:01:00.000Z");
      expect(readInvalidatedAt(db, "validation_results", "validation_spec_changed")).toBe("2026-06-07T00:01:00.000Z");
      expect(readInvalidatedAt(db, "qa_results", "qa_spec_changed")).toBe("2026-06-07T00:01:00.000Z");
      expect(readInvalidatedAt(db, "exports", "export_changed")).toBe("2026-06-07T00:01:00.000Z");

      expect(readInvalidatedAt(db, "candidates", "candidate_retained")).toBeNull();
      expect(readInvalidatedAt(db, "approvals", "approval_candidate_retained")).toBeNull();
      expect(readInvalidatedAt(db, "generated_specs", "spec_retained")).toBeNull();
      expect(readInvalidatedAt(db, "validation_results", "validation_spec_retained")).toBeNull();
      expect(readInvalidatedAt(db, "qa_results", "qa_spec_retained")).toBeNull();
      expect(readInvalidatedAt(db, "exports", "export_retained")).toBeNull();
    } finally {
      db.close();
    }
  });

  it("rejects stale updates before invalidating generated state", async () => {
    const db = createMigratedDatabase();
    const service = createArticleService({
      createId: () => "article_invalidation_1",
      db,
      now: () => new Date("2026-06-07T00:00:00.000Z")
    });

    try {
      const first = await service.createArticle("Original paragraph.");
      const [block] = first.blocks;
      if (!block) {
        throw new Error("expected test article block");
      }
      insertGeneratedState(db, {
        articleId: first.id,
        blockId: block.id,
        candidateId: "candidate_current",
        specId: "spec_current",
        exportId: "export_current"
      });

      await expect(service.updateArticle(first.id, "Changed paragraph.", 0)).rejects.toBeInstanceOf(
        ArticleVersionConflictError
      );

      expect(readInvalidatedAt(db, "candidates", "candidate_current")).toBeNull();
    } finally {
      db.close();
    }
  });
});

interface GeneratedStateFixture {
  articleId: string;
  blockId: string;
  candidateId: string;
  specId: string;
  exportId: string;
}

function insertGeneratedState(db: BanderdashDatabase, fixture: GeneratedStateFixture): void {
  db.prepare(
    "insert into candidates (id, article_id, document_version, block_id, status, payload_json) values (?, ?, 1, ?, 'proposed', '{}')"
  ).run(fixture.candidateId, fixture.articleId, fixture.blockId);
  db.prepare(
    "insert into approvals (id, candidate_id, article_id, document_version, decision, payload_json) values (?, ?, ?, 1, 'approved', '{}')"
  ).run(`approval_${fixture.candidateId}`, fixture.candidateId, fixture.articleId);
  db.prepare(
    "insert into generated_specs (id, candidate_id, article_id, document_version, payload_json) values (?, ?, ?, 1, '{}')"
  ).run(fixture.specId, fixture.candidateId, fixture.articleId);
  db.prepare(
    "insert into validation_results (id, generated_spec_id, article_id, document_version, status, payload_json) values (?, ?, ?, 1, 'passed', '{}')"
  ).run(`validation_${fixture.specId}`, fixture.specId, fixture.articleId);
  db.prepare(
    "insert into qa_results (id, generated_spec_id, article_id, document_version, status, payload_json) values (?, ?, ?, 1, 'passed', '{}')"
  ).run(`qa_${fixture.specId}`, fixture.specId, fixture.articleId);
  db.prepare("insert into exports (id, article_id, document_version, manifest_json, payload_json) values (?, ?, 1, '{}', ?)").run(
    fixture.exportId,
    fixture.articleId,
    JSON.stringify({ candidateId: fixture.candidateId })
  );
}

function readInvalidatedAt(db: BanderdashDatabase, table: string, id: string): string | null {
  const row = db.prepare(`select invalidated_at from ${table} where id = ?`).get(id) as { invalidated_at: string | null };
  return row.invalidated_at;
}
