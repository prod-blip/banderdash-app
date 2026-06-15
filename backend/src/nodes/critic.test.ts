import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeProvider } from "@banderdash/providers";
import { afterEach, describe, expect, it } from "vitest";
import { createArticleService } from "../services/articles.js";
import { connectDatabase, type BanderdashDatabase } from "../services/db.js";
import { runMigrations } from "../services/migrations.js";
import type { InteractionCandidate } from "./schemas/candidate.js";
import { CriticCandidateValidationError, CriticProviderCapabilityError, buildCriticMessages, runCriticNode } from "./critic.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-critic-test-"));
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

describe("Critic node", () => {
  it("rejects decorative candidates and persists critic decisions", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20 after the pricing change.");
      const blockId = article.blocks[0]?.id ?? "missing";
      const proposedCandidate = createCandidate(article.id, article.version, blockId, {
        id: "candidate_decorative",
        rationale: "This would make the sentence visually interesting.",
        understandingLossIfRemoved: "No meaningful understanding would be lost.",
        status: "proposed"
      });
      insertCandidate(db, proposedCandidate);

      const provider = createFakeProvider({
        structuredValue: {
          candidates: [
            {
              ...proposedCandidate,
              rationale: "This is decorative emphasis rather than a meaning-bearing interaction.",
              understandingLossIfRemoved: "No core claim or relationship becomes harder to understand if removed.",
              status: "rejected_by_critic"
            }
          ]
        }
      });

      const reviewed = await runCriticNode({
        article,
        candidates: [proposedCandidate],
        db,
        model: "fake-model",
        now: () => new Date("2026-06-08T00:01:00.000Z"),
        provider
      });

      expect(reviewed).toHaveLength(1);
      expect(reviewed[0]).toMatchObject({ id: "candidate_decorative", status: "rejected_by_critic" });

      const rows = db.prepare("select id, status, payload_json, updated_at from candidates").all() as Array<{
        id: string;
        payload_json: string;
        status: string;
        updated_at: string;
      }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        id: "candidate_decorative",
        status: "rejected_by_critic",
        updated_at: "2026-06-08T00:01:00.000Z"
      });
      expect(JSON.parse(rows[0]?.payload_json ?? "{}")).toMatchObject({
        understandingLossIfRemoved: "No core claim or relationship becomes harder to understand if removed."
      });
    } finally {
      db.close();
    }
  });

  it("survives candidates with clear understanding loss", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("A 10% price increase becomes a 25% profit increase because costs are fixed.");
      const blockId = article.blocks[0]?.id ?? "missing";
      const proposedCandidate = createCandidate(article.id, article.version, blockId, {
        id: "candidate_meaningful",
        rationale: "The interaction lets readers test the fixed-cost relationship.",
        understandingLossIfRemoved: "Readers lose the ability to see how price changes amplify profit under fixed costs.",
        status: "proposed"
      });
      insertCandidate(db, proposedCandidate);

      const provider = createFakeProvider({ structuredValue: { candidates: [{ ...proposedCandidate, status: "survived" }] } });
      const reviewed = await runCriticNode({ article, candidates: [proposedCandidate], db, model: "fake-model", provider });

      expect(reviewed[0]).toMatchObject({ id: "candidate_meaningful", status: "survived" });
      expect(db.prepare("select status from candidates where id = ?").get("candidate_meaningful")).toMatchObject({ status: "survived" });
    } finally {
      db.close();
    }
  });

  it("fails when provider does not support structured output", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("A useful paragraph.");
      const blockId = article.blocks[0]?.id ?? "missing";
      const provider = createFakeProvider({ capabilities: { supportsStructuredOutput: false } });
      const proposedCandidate = createCandidate(article.id, article.version, blockId);

      await expect(runCriticNode({ article, candidates: [proposedCandidate], db, model: "fake-model", provider })).rejects.toBeInstanceOf(
        CriticProviderCapabilityError
      );
    } finally {
      db.close();
    }
  });

  it("rejects critic output that omits a proposed candidate", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("A useful paragraph.");
      const blockId = article.blocks[0]?.id ?? "missing";
      const firstCandidate = createCandidate(article.id, article.version, blockId, { id: "candidate_1" });
      const secondCandidate = createCandidate(article.id, article.version, blockId, { id: "candidate_2" });
      insertCandidate(db, firstCandidate);
      insertCandidate(db, secondCandidate);
      const provider = createFakeProvider({ structuredValue: { candidates: [{ ...firstCandidate, status: "survived" }] } });

      await expect(
        runCriticNode({ article, candidates: [firstCandidate, secondCandidate], db, model: "fake-model", provider })
      ).rejects.toBeInstanceOf(CriticCandidateValidationError);
    } finally {
      db.close();
    }
  });

  it("builds prompts with the core meaning rule and candidate IDs", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("A useful paragraph.");
      const candidate = createCandidate(article.id, article.version, article.blocks[0]?.id ?? "missing");
      const messages = buildCriticMessages(article, [candidate]);

      expect(messages[0]?.content).toContain("enact meaning, not decorate");
      expect(messages[0]?.content).toContain("decorative animation");
      expect(messages[0]?.content).toContain("jargon explanations");
      expect(messages[0]?.content).toContain("prose already carries the meaning");
      expect(messages[1]?.content).toContain(candidate.id);
    } finally {
      db.close();
    }
  });
});

function createCandidate(
  articleId: string,
  documentVersion: number,
  blockId: string,
  overrides: Partial<InteractionCandidate> = {}
): InteractionCandidate {
  return {
    id: "candidate_1",
    articleId,
    documentVersion,
    blockIds: [blockId],
    spanIds: [],
    pattern: "ReactiveValue",
    rationale: "The block contains a numeric relationship.",
    requiredData: [],
    libraryRepresentable: true,
    understandingLossIfRemoved: "Readers lose the ability to test how the numeric relationship affects the claim.",
    status: "proposed",
    ...overrides
  };
}

function insertCandidate(db: BanderdashDatabase, candidate: InteractionCandidate): void {
  db.prepare(
    `insert into candidates (id, article_id, document_version, block_id, status, payload_json)
      values (?, ?, ?, ?, ?, ?)`
  ).run(candidate.id, candidate.articleId, candidate.documentVersion, candidate.blockIds[0] ?? null, candidate.status, JSON.stringify(candidate));
}
