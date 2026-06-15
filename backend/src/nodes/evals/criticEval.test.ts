import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeProvider } from "@banderdash/providers";
import { afterEach, describe, expect, it } from "vitest";
import { connectDatabase, type BanderdashDatabase } from "../../services/db.js";
import { runMigrations } from "../../services/migrations.js";
import { runCriticNode } from "../critic.js";
import type { InteractionCandidate } from "../schemas/candidate.js";
import { criticEvalFixtures } from "./critic.fixtures.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-critic-eval-test-"));
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

describe("critic evaluation fixtures", () => {
  it("cover the current MVP pruning cases", () => {
    expect(criticEvalFixtures.map((fixture) => fixture.id)).toEqual([
      "meaningful_quantity_interaction",
      "decorative_animation",
      "useful_comparison",
      "shallow_comparison",
      "jargon_explanation",
      "thematic_vague_suggestion"
    ]);
    expect(criticEvalFixtures.some((fixture) => fixture.expected.status === "survived")).toBe(true);
    expect(criticEvalFixtures.some((fixture) => fixture.expected.status === "rejected_by_critic")).toBe(true);
  });

  it.each(criticEvalFixtures)("matches deterministic critic expectation: $name", async (fixture) => {
    const db = createMigratedDatabase();
    try {
      insertArticle(db, fixture.article);
      insertCandidate(db, fixture.candidate);

      const reviewedCandidate: InteractionCandidate = {
        ...fixture.candidate,
        status: fixture.expected.status,
        rationale: fixture.expected.reason,
        understandingLossIfRemoved:
          fixture.expected.status === "survived"
            ? fixture.candidate.understandingLossIfRemoved
            : `Rejected by critic: ${fixture.expected.reason}`
      };
      const provider = createFakeProvider({ structuredValue: { candidates: [reviewedCandidate] } });

      const reviewed = await runCriticNode({
        article: fixture.article,
        candidates: [fixture.candidate],
        db,
        model: "fake-critic-eval",
        now: () => new Date("2026-06-15T00:01:00.000Z"),
        provider
      });

      expect(reviewed).toHaveLength(1);
      expect(reviewed[0]).toMatchObject({ id: fixture.candidate.id, status: fixture.expected.status });
      expect(db.prepare("select status from candidates where id = ?").get(fixture.candidate.id)).toMatchObject({
        status: fixture.expected.status
      });
    } finally {
      db.close();
    }
  });
});

function insertArticle(db: BanderdashDatabase, article: (typeof criticEvalFixtures)[number]["article"]): void {
  db.prepare(
    `insert into articles (id, current_version, payload_json, created_at, updated_at)
      values (?, ?, ?, ?, ?)`
  ).run(article.id, article.version, JSON.stringify(article), article.meta.createdAt, article.meta.updatedAt);
  db.prepare(
    `insert into article_versions (id, article_id, version, payload_json, created_at)
      values (?, ?, ?, ?, ?)`
  ).run(`${article.id}_v${article.version}`, article.id, article.version, JSON.stringify(article), article.meta.createdAt);

  for (const [index, block] of article.blocks.entries()) {
    db.prepare(
      `insert into article_blocks (id, article_id, document_version, block_index, block_type, text, payload_json, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(block.id, article.id, article.version, index, block.type, block.text, JSON.stringify(block), article.meta.createdAt);
  }
}

function insertCandidate(db: BanderdashDatabase, candidate: InteractionCandidate): void {
  db.prepare(
    `insert into candidates (id, article_id, document_version, block_id, status, payload_json)
      values (?, ?, ?, ?, ?, ?)`
  ).run(candidate.id, candidate.articleId, candidate.documentVersion, candidate.blockIds[0] ?? null, candidate.status, JSON.stringify(candidate));
}
