import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeProvider } from "@banderdash/providers";
import { afterEach, describe, expect, it } from "vitest";
import { createArticleService } from "../services/articles.js";
import { connectDatabase, type BanderdashDatabase } from "../services/db.js";
import { runMigrations } from "../services/migrations.js";
import { AnalystCandidateValidationError, AnalystProviderCapabilityError, buildAnalystMessages, runAnalystNode } from "./analyst.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-analyst-test-"));
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

describe("Analyst node", () => {
  it("requests structured candidate output and persists candidates", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({
      createId: () => "article_test_1",
      db,
      now: () => new Date("2026-06-07T00:00:00.000Z")
    });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20 after the pricing change.");
      const blockId = article.blocks[0]?.id ?? "missing";
      const provider = createFakeProvider({
        structuredValue: {
          candidates: [
            {
              id: "candidate_1",
              articleId: article.id,
              documentVersion: article.version,
              blockIds: [blockId],
              spanIds: [],
              pattern: "ReactiveValue",
              rationale: "The block contains a numeric before/after relationship.",
              requiredData: ["before revenue", "after revenue"],
              libraryRepresentable: true,
              understandingLossIfRemoved: "Readers lose the ability to test how the numeric change affects the claim.",
              status: "proposed"
            }
          ]
        }
      });

      const candidates = await runAnalystNode({
        article,
        db,
        model: "fake-model",
        now: () => new Date("2026-06-07T00:01:00.000Z"),
        provider
      });

      expect(candidates).toHaveLength(1);
      expect(candidates[0]).toMatchObject({ id: "candidate_1", blockIds: [blockId], pattern: "ReactiveValue" });

      const rows = db.prepare("select id, article_id, document_version, block_id, status, payload_json from candidates").all() as Array<{
        article_id: string;
        block_id: string;
        document_version: number;
        id: string;
        payload_json: string;
        status: string;
      }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        article_id: article.id,
        block_id: blockId,
        document_version: 1,
        id: "candidate_1",
        status: "proposed"
      });
      expect(JSON.parse(rows[0]?.payload_json ?? "{}")).toMatchObject({ understandingLossIfRemoved: expect.any(String) });
    } finally {
      db.close();
    }
  });

  it("fails when provider does not support structured output", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("A useful paragraph.");
      const provider = createFakeProvider({ capabilities: { supportsStructuredOutput: false } });

      await expect(runAnalystNode({ article, db, model: "fake-model", provider })).rejects.toBeInstanceOf(
        AnalystProviderCapabilityError
      );
    } finally {
      db.close();
    }
  });

  it("rejects candidates that reference unknown blocks", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("A useful paragraph.");
      const provider = createFakeProvider({
        structuredValue: {
          candidates: [
            {
              id: "candidate_1",
              articleId: article.id,
              documentVersion: article.version,
              blockIds: ["missing_block"],
              spanIds: [],
              pattern: "ReactiveValue",
              rationale: "Rationale exists.",
              requiredData: [],
              libraryRepresentable: true,
              understandingLossIfRemoved: "Meaning loss exists.",
              status: "proposed"
            }
          ]
        }
      });

      await expect(runAnalystNode({ article, db, model: "fake-model", provider })).rejects.toBeInstanceOf(
        AnalystCandidateValidationError
      );
    } finally {
      db.close();
    }
  });

  it("builds prompts with article block IDs", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("A useful paragraph.");
      const messages = buildAnalystMessages(article);

      expect(messages[0]?.content).toContain("enact meaning");
      expect(messages[0]?.content).toContain("Reject decorative");
      expect(messages[0]?.content).toContain("Prefer audited library patterns");
      expect(messages[0]?.content).toContain("prose alone");
      expect(messages[1]?.content).toContain(article.blocks[0]?.id);
    } finally {
      db.close();
    }
  });
});
