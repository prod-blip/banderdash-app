import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createArticleService } from "./articles.js";
import { createCandidateConsentService, CandidateConsentValidationError, CandidateConsentVersionConflictError } from "./candidateConsent.js";
import { connectDatabase, type BanderdashDatabase } from "./db.js";
import { runMigrations } from "./migrations.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-consent-test-"));
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

describe("candidate consent service", () => {
  it("records writer approval only for Critic-surviving candidates", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      insertCandidate(db, { articleId: article.id, blockId: article.blocks[0]?.id ?? "missing", id: "candidate_1", status: "survived" });
      const consentService = createCandidateConsentService({
        createId: () => "approval_1",
        db,
        now: () => new Date("2026-06-10T00:00:00.000Z")
      });

      const approval = await consentService.recordConsent({
        articleId: article.id,
        candidateId: "candidate_1",
        decision: "approved",
        expectedVersion: article.version
      });

      expect(approval).toMatchObject({ id: "approval_1", candidateId: "candidate_1", decision: "approved" });
      const row = db.prepare("select id, candidate_id, decision, payload_json from approvals").get() as {
        candidate_id: string;
        decision: string;
        id: string;
        payload_json: string;
      };
      expect(row).toMatchObject({ id: "approval_1", candidate_id: "candidate_1", decision: "approved" });
      expect(JSON.parse(row.payload_json)).toMatchObject({ documentVersion: 1 });
    } finally {
      db.close();
    }
  });

  it("rejects consent for proposed candidates that have not survived Critic review", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      insertCandidate(db, { articleId: article.id, blockId: article.blocks[0]?.id ?? "missing", id: "candidate_1", status: "proposed" });
      const consentService = createCandidateConsentService({ db });

      await expect(
        consentService.recordConsent({
          articleId: article.id,
          candidateId: "candidate_1",
          decision: "approved",
          expectedVersion: article.version
        })
      ).rejects.toBeInstanceOf(CandidateConsentValidationError);
    } finally {
      db.close();
    }
  });

  it("rejects stale writer consent after article edits", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      insertCandidate(db, { articleId: article.id, blockId: article.blocks[0]?.id ?? "missing", id: "candidate_1", status: "survived" });
      await articleService.updateArticle(article.id, "Revenue grew from 10 to 30.", article.version);
      const consentService = createCandidateConsentService({ db });

      await expect(
        consentService.recordConsent({
          articleId: article.id,
          candidateId: "candidate_1",
          decision: "approved",
          expectedVersion: article.version
        })
      ).rejects.toBeInstanceOf(CandidateConsentVersionConflictError);
    } finally {
      db.close();
    }
  });

  it("rejects invalidated candidates", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      insertCandidate(db, { articleId: article.id, blockId: article.blocks[0]?.id ?? "missing", id: "candidate_1", status: "survived" });
      db.prepare("update candidates set invalidated_at = ? where id = ?").run("2026-06-10T00:00:00.000Z", "candidate_1");
      const consentService = createCandidateConsentService({ db });

      await expect(
        consentService.recordConsent({
          articleId: article.id,
          candidateId: "candidate_1",
          decision: "rejected",
          expectedVersion: article.version
        })
      ).rejects.toBeInstanceOf(CandidateConsentValidationError);
    } finally {
      db.close();
    }
  });
});

function insertCandidate(
  db: BanderdashDatabase,
  options: { articleId: string; blockId: string; id: string; status: string }
): void {
  db.prepare(
    `insert into candidates (id, article_id, document_version, block_id, status, payload_json)
      values (?, ?, 1, ?, ?, '{}')`
  ).run(options.id, options.articleId, options.blockId, options.status);
}
