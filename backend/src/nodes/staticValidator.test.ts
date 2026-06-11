import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createArticleService } from "../services/articles.js";
import { connectDatabase, type BanderdashDatabase } from "../services/db.js";
import { runMigrations } from "../services/migrations.js";
import type { LibraryBuildUnit } from "./builder.js";
import { runStaticValidatorNode } from "./staticValidator.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-static-validator-test-"));
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

describe("Static Validator node", () => {
  it("persists a passing validation result for a safe library build unit", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = createBuildUnit(article.id, article.version);
      insertGeneratedSpecFixture(db, unit);

      const records = runStaticValidatorNode({
        buildUnits: [unit],
        componentSourceByPath: { [unit.componentPath]: safeComponentSource },
        db,
        now: () => new Date("2026-06-11T00:00:00.000Z")
      });

      expect(records).toEqual([
        {
          id: "validation_spec_1",
          generatedSpecId: "spec_1",
          articleId: article.id,
          documentVersion: article.version,
          status: "passed",
          result: { ok: true, hardFailures: [], warnings: [] }
        }
      ]);
      expect(readValidationRows(db)).toEqual([
        {
          article_id: article.id,
          created_at: "2026-06-11T00:00:00.000Z",
          document_version: article.version,
          generated_spec_id: "spec_1",
          id: "validation_spec_1",
          payload_json: JSON.stringify({ ok: true, hardFailures: [], warnings: [] }),
          status: "passed"
        }
      ]);
    } finally {
      db.close();
    }
  });

  it("persists hard failures for unsafe component source", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = createBuildUnit(article.id, article.version);
      insertGeneratedSpecFixture(db, unit);

      const records = runStaticValidatorNode({
        buildUnits: [unit],
        componentSourceByPath: { [unit.componentPath]: `<script>fetch('https://example.com')</script>` },
        db
      });

      expect(records[0]?.status).toBe("failed");
      expect(records[0]?.result.hardFailures).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "RUNTIME_NETWORK_FETCH" }), expect.objectContaining({ code: "REMOTE_URL" })])
      );
      expect(readValidationRows(db)[0]?.status).toBe("failed");
    } finally {
      db.close();
    }
  });

  it("fails closed when component source is missing", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = createBuildUnit(article.id, article.version);
      insertGeneratedSpecFixture(db, unit);

      const records = runStaticValidatorNode({ buildUnits: [unit], componentSourceByPath: {}, db });

      expect(records[0]?.status).toBe("failed");
      expect(records[0]?.result.hardFailures).toEqual([
        { code: "MISSING_COMPONENT_SOURCE", message: "No component source was provided for packages/components/src/ReactiveValue.svelte." }
      ]);
    } finally {
      db.close();
    }
  });
});

const safeComponentSource = `<script lang="ts">
  import { computeReactiveValue } from "./reactiveValue.schema.js";
  export let props;
  $: resultValue = computeReactiveValue(props, props.initialValue);
</script>
<section><p>{props.fallbackText}</p><output>{resultValue}</output></section>`;

function createBuildUnit(articleId: string, documentVersion: number): LibraryBuildUnit {
  return {
    id: "build_spec_1",
    specId: "spec_1",
    candidateId: "candidate_1",
    articleId,
    documentVersion,
    mode: "library",
    componentName: "ReactiveValue",
    componentPath: "packages/components/src/ReactiveValue.svelte",
    props: {},
    embeddedData: {},
    fallbackText: "Revenue doubled from 10 to 20.",
    accessibilityNotes: "Labelled range input with text result.",
    reducedMotionRequirements: "No animation required."
  };
}

function insertGeneratedSpecFixture(db: BanderdashDatabase, unit: LibraryBuildUnit): void {
  db.prepare(
    `insert into candidates (id, article_id, document_version, block_id, status, payload_json)
      values (?, ?, ?, null, 'survived', '{}')`
  ).run(unit.candidateId, unit.articleId, unit.documentVersion);
  db.prepare(
    `insert into generated_specs (id, candidate_id, article_id, document_version, payload_json)
      values (?, ?, ?, ?, '{}')`
  ).run(unit.specId, unit.candidateId, unit.articleId, unit.documentVersion);
}

function readValidationRows(db: BanderdashDatabase): Array<{
  article_id: string;
  created_at: string;
  document_version: number;
  generated_spec_id: string;
  id: string;
  payload_json: string;
  status: string;
}> {
  return db
    .prepare("select id, generated_spec_id, article_id, document_version, status, payload_json, created_at from validation_results")
    .all() as Array<{
    article_id: string;
    created_at: string;
    document_version: number;
    generated_spec_id: string;
    id: string;
    payload_json: string;
    status: string;
  }>;
}
