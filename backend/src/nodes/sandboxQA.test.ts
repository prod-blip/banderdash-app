import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createArticleService } from "../services/articles.js";
import { connectDatabase, type BanderdashDatabase } from "../services/db.js";
import { evaluatePreviewExportEligibility } from "../services/qaResults.js";
import { runMigrations } from "../services/migrations.js";
import type { LibraryBuildUnit } from "./builder.js";
import type { StaticValidationRecord } from "./staticValidator.js";
import { runSandboxQANode } from "./sandboxQA.js";

const tempDirectories: string[] = [];

function createTempDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-sandbox-qa-test-"));
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

describe("Sandbox QA node", () => {
  it("persists a passing QA result when component source mounts and has fallback/accessibility basics", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = createBuildUnit(article.id, article.version);
      insertGeneratedSpecFixture(db, unit);

      const records = runSandboxQANode({
        buildUnits: [unit],
        componentSourceByPath: { [unit.componentPath]: labelledComponentSource },
        db,
        mountComponent: () => undefined,
        now: () => new Date("2026-06-12T00:00:00.000Z")
      });

      expect(records).toEqual([
        {
          id: "qa_spec_1",
          generatedSpecId: "spec_1",
          articleId: article.id,
          documentVersion: article.version,
          status: "passed",
          result: { ok: true, findings: [] }
        }
      ]);
      expect(readQARows(db)).toEqual([
        {
          article_id: article.id,
          created_at: "2026-06-12T00:00:00.000Z",
          document_version: article.version,
          generated_spec_id: "spec_1",
          id: "qa_spec_1",
          payload_json: JSON.stringify({ ok: true, findings: [] }),
          status: "passed"
        }
      ]);
    } finally {
      db.close();
    }
  });

  it("captures runtime mount errors as warn-but-confirm QA crashes", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = createBuildUnit(article.id, article.version);
      insertGeneratedSpecFixture(db, unit);

      const records = runSandboxQANode({
        buildUnits: [unit],
        componentSourceByPath: { [unit.componentPath]: labelledComponentSource },
        db,
        mountComponent: () => {
          throw new Error("boom");
        }
      });

      expect(records[0]?.status).toBe("crashed");
      expect(records[0]?.result.findings).toEqual([
        {
          code: "RUNTIME_ERROR_CAPTURED",
          message: "Sandbox mount captured a runtime error for ReactiveValue: boom.",
          severity: "crash"
        }
      ]);
    } finally {
      db.close();
    }
  });

  it("warns when fallback text is missing", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = { ...createBuildUnit(article.id, article.version), fallbackText: "" };
      insertGeneratedSpecFixture(db, unit);

      const records = runSandboxQANode({
        buildUnits: [unit],
        componentSourceByPath: { [unit.componentPath]: labelledComponentSource },
        db
      });

      expect(records[0]?.status).toBe("warning");
      expect(records[0]?.result.findings).toEqual([
        {
          code: "MISSING_FALLBACK_TEXT",
          message: "ReactiveValue does not include fallback text for non-interactive contexts.",
          severity: "warning"
        }
      ]);
    } finally {
      db.close();
    }
  });

  it("warns when standard controls lack basic labels", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = createBuildUnit(article.id, article.version);
      insertGeneratedSpecFixture(db, unit);

      const records = runSandboxQANode({
        buildUnits: [unit],
        componentSourceByPath: { [unit.componentPath]: `<input type="range"><output>20</output>` },
        db
      });

      expect(records[0]?.status).toBe("warning");
      expect(records[0]?.result.findings).toEqual([
        {
          code: "BASIC_LABEL_WARNING",
          message: "ReactiveValue uses a standard control without an obvious label, aria-label, or aria-labelledby.",
          severity: "warning"
        }
      ]);
    } finally {
      db.close();
    }
  });

  it("warns when standard controls disable keyboard reachability", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = createBuildUnit(article.id, article.version);
      insertGeneratedSpecFixture(db, unit);

      const records = runSandboxQANode({
        buildUnits: [unit],
        componentSourceByPath: { [unit.componentPath]: `<label>Value<input type="range" tabindex="-1"></label>` },
        db
      });

      expect(records[0]?.status).toBe("warning");
      expect(records[0]?.result.findings).toEqual([
        {
          code: "KEYBOARD_REACHABILITY_WARNING",
          message: "ReactiveValue disables keyboard reachability for a standard control.",
          severity: "warning"
        }
      ]);
    } finally {
      db.close();
    }
  });

  it("warns when animation is present without reduced-motion support", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = { ...createBuildUnit(article.id, article.version), reducedMotionRequirements: "" };
      insertGeneratedSpecFixture(db, unit);

      const records = runSandboxQANode({
        buildUnits: [unit],
        componentSourceByPath: { [unit.componentPath]: `<label>Value<input type="range"></label><style>output { transition: opacity 1s; }</style>` },
        db
      });

      expect(records[0]?.status).toBe("warning");
      expect(records[0]?.result.findings).toEqual([
        {
          code: "REDUCED_MOTION_WARNING",
          message: "ReactiveValue appears to animate without prefers-reduced-motion support or documented reduced-motion requirements.",
          severity: "warning"
        }
      ]);
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

      const records = runSandboxQANode({ buildUnits: [unit], componentSourceByPath: {}, db });

      expect(records[0]?.status).toBe("crashed");
      expect(records[0]?.result.findings).toEqual([
        {
          code: "COMPONENT_BUILD_MISSING_SOURCE",
          message: "No component source was provided for packages/components/src/ReactiveValue.svelte.",
          severity: "crash"
        }
      ]);
    } finally {
      db.close();
    }
  });
});

describe("preview/export eligibility", () => {
  it("hard-blocks preview and export when static validation fails", () => {
    const eligibility = evaluatePreviewExportEligibility({
      validationRecords: [createValidationRecord("failed")],
      qaRecords: []
    });

    expect(eligibility).toEqual({
      previewAllowed: false,
      exportAllowed: false,
      requiresExplicitQAConfirmation: false,
      hardBlocks: ["Static validation failed for spec_1."],
      warnings: []
    });
  });

  it("allows preview but requires explicit confirmation for QA warnings or crashes before export", () => {
    const qaRecord = createQARecord("crashed");

    expect(
      evaluatePreviewExportEligibility({ validationRecords: [createValidationRecord("passed")], qaRecords: [qaRecord] })
    ).toMatchObject({
      previewAllowed: true,
      exportAllowed: false,
      requiresExplicitQAConfirmation: true
    });
    expect(
      evaluatePreviewExportEligibility({
        validationRecords: [createValidationRecord("passed")],
        qaOverrideConfirmed: true,
        qaRecords: [qaRecord]
      })
    ).toMatchObject({
      previewAllowed: true,
      exportAllowed: true,
      requiresExplicitQAConfirmation: false
    });
  });
});

const labelledComponentSource = `<label>Value<input type="range" /></label><output aria-live="polite">20</output>`;

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

function readQARows(db: BanderdashDatabase): Array<{
  article_id: string;
  created_at: string;
  document_version: number;
  generated_spec_id: string;
  id: string;
  payload_json: string;
  status: string;
}> {
  return db
    .prepare("select id, generated_spec_id, article_id, document_version, status, payload_json, created_at from qa_results")
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

function createValidationRecord(status: "passed" | "failed"): StaticValidationRecord {
  return {
    id: "validation_spec_1",
    generatedSpecId: "spec_1",
    articleId: "article_1",
    documentVersion: 1,
    status,
    result: { ok: status === "passed", hardFailures: [], warnings: [] }
  };
}

function createQARecord(status: "passed" | "warning" | "crashed") {
  return {
    id: "qa_spec_1",
    generatedSpecId: "spec_1",
    articleId: "article_1",
    documentVersion: 1,
    status,
    result: {
      ok: status !== "crashed",
      findings: [
        {
          code: "RUNTIME_ERROR_CAPTURED",
          message: "Sandbox mount captured a runtime error for ReactiveValue: boom.",
          severity: "crash" as const
        }
      ]
    }
  };
}
