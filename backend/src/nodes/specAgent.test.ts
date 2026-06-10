import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFakeProvider } from "@banderdash/providers";
import { afterEach, describe, expect, it } from "vitest";
import { createArticleService } from "../services/articles.js";
import { connectDatabase, type BanderdashDatabase } from "../services/db.js";
import { runMigrations } from "../services/migrations.js";
import type { InteractionCandidate } from "./schemas/candidate.js";
import type { ComponentSpec } from "./schemas/componentSpec.js";
import { buildSpecAgentMessages, runSpecAgentNode, SpecAgentProviderCapabilityError, SpecAgentValidationError } from "./specAgent.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-spec-agent-test-"));
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

describe("Spec Agent node", () => {
  it("converts approved ReactiveValue candidates into persisted component specs", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const candidate = createCandidate(article.id, article.version, article.blocks[0]?.id ?? "missing");
      insertCandidateAndApproval(db, candidate);
      const spec = createSpec(article.id, article.version, candidate.id);
      const provider = createFakeProvider({ structuredValue: { specs: [spec] } });

      const specs = await runSpecAgentNode({
        article,
        candidates: [candidate],
        db,
        model: "fake-model",
        now: () => new Date("2026-06-10T00:00:00.000Z"),
        provider
      });

      expect(specs).toHaveLength(1);
      expect(specs[0]).toMatchObject({ candidateId: candidate.id, componentName: "ReactiveValue" });
      const rows = db.prepare("select id, candidate_id, article_id, document_version, payload_json, created_at from generated_specs").all() as Array<{
        article_id: string;
        candidate_id: string;
        created_at: string;
        document_version: number;
        id: string;
        payload_json: string;
      }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        article_id: article.id,
        candidate_id: candidate.id,
        created_at: "2026-06-10T00:00:00.000Z",
        document_version: article.version,
        id: "spec_1"
      });
      expect(JSON.parse(rows[0]?.payload_json ?? "{}")).toMatchObject({ fallbackText: "Revenue doubled from 10 to 20." });
    } finally {
      db.close();
    }
  });

  it("ignores candidates without writer approval", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const candidate = createCandidate(article.id, article.version, article.blocks[0]?.id ?? "missing");
      insertCandidate(db, candidate);
      const provider = createFakeProvider({ structuredValue: { specs: [createSpec(article.id, article.version, candidate.id)] } });

      const specs = await runSpecAgentNode({ article, candidates: [candidate], db, model: "fake-model", provider });

      expect(specs).toEqual([]);
      expect(db.prepare("select count(*) as count from generated_specs").get()).toMatchObject({ count: 0 });
    } finally {
      db.close();
    }
  });

  it("fails when provider does not support structured output", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const candidate = createCandidate(article.id, article.version, article.blocks[0]?.id ?? "missing");
      insertCandidateAndApproval(db, candidate);
      const provider = createFakeProvider({ capabilities: { supportsStructuredOutput: false } });

      await expect(runSpecAgentNode({ article, candidates: [candidate], db, model: "fake-model", provider })).rejects.toBeInstanceOf(
        SpecAgentProviderCapabilityError
      );
    } finally {
      db.close();
    }
  });

  it("rejects invalid ReactiveValue props", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const candidate = createCandidate(article.id, article.version, article.blocks[0]?.id ?? "missing");
      insertCandidateAndApproval(db, candidate);
      const invalidSpec = createSpec(article.id, article.version, candidate.id, { props: { fallbackText: "" } });
      const provider = createFakeProvider({ structuredValue: { specs: [invalidSpec] } });

      await expect(runSpecAgentNode({ article, candidates: [candidate], db, model: "fake-model", provider })).rejects.toBeInstanceOf(
        SpecAgentValidationError
      );
    } finally {
      db.close();
    }
  });

  it("builds prompts with approved candidate IDs", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const candidate = createCandidate(article.id, article.version, article.blocks[0]?.id ?? "missing");
      const messages = buildSpecAgentMessages(article, [candidate]);

      expect(messages[0]?.content).toContain("Spec Agent");
      expect(messages[1]?.content).toContain(candidate.id);
    } finally {
      db.close();
    }
  });
});

function createCandidate(articleId: string, documentVersion: number, blockId: string): InteractionCandidate {
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
    understandingLossIfRemoved: "Readers lose the ability to test the numeric relationship.",
    status: "survived"
  };
}

function createSpec(
  articleId: string,
  documentVersion: number,
  candidateId: string,
  overrides: Partial<ComponentSpec> = {}
): ComponentSpec {
  return {
    id: "spec_1",
    candidateId,
    articleId,
    documentVersion,
    mode: "library",
    componentName: "ReactiveValue",
    props: {
      label: "Revenue input",
      initialValue: 10,
      min: 0,
      max: 100,
      step: 1,
      calculation: { operation: "multiply", operand: 2, precision: 0 },
      resultLabel: "Projected revenue",
      fallbackText: "Revenue doubled from 10 to 20."
    },
    embeddedData: { sourceBlockIds: ["block_1"] },
    fallbackText: "Revenue doubled from 10 to 20.",
    accessibilityNotes: "Labelled range input with text result.",
    reducedMotionRequirements: "No animation required.",
    ...overrides
  };
}

function insertCandidateAndApproval(db: BanderdashDatabase, candidate: InteractionCandidate): void {
  insertCandidate(db, candidate);
  db.prepare(
    `insert into approvals (id, candidate_id, article_id, document_version, decision, payload_json)
      values ('approval_1', ?, ?, ?, 'approved', '{}')`
  ).run(candidate.id, candidate.articleId, candidate.documentVersion);
}

function insertCandidate(db: BanderdashDatabase, candidate: InteractionCandidate): void {
  db.prepare(
    `insert into candidates (id, article_id, document_version, block_id, status, payload_json)
      values (?, ?, ?, ?, ?, ?)`
  ).run(candidate.id, candidate.articleId, candidate.documentVersion, candidate.blockIds[0] ?? null, candidate.status, JSON.stringify(candidate));
}
