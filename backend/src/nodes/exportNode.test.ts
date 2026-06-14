import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createArticleService } from "../services/articles.js";
import { connectDatabase, type BanderdashDatabase } from "../services/db.js";
import { ExportEligibilityError, getExportRecord } from "../services/exports.js";
import { runMigrations } from "../services/migrations.js";
import type { SandboxQARecord } from "../services/qaResults.js";
import type { LibraryBuildUnit } from "./builder.js";
import { runExportNode } from "./exportNode.js";
import type { StaticValidationRecord } from "./staticValidator.js";

const tempDirectories: string[] = [];

function createTempDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  tempDirectories.push(directory);
  return directory;
}

function createMigratedDatabase(): BanderdashDatabase {
  const db = connectDatabase({ sqlitePath: join(createTempDirectory("banderdash-export-node-db-"), "state", "banderdash.sqlite") });
  runMigrations(db);
  return db;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("Export node", () => {
  it("builds immutable artifacts and persists a SQLite export record when validation and QA allow export", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });
    const outputDir = createTempDirectory("banderdash-export-node-output-");
    const temporaryArtifactDir = join(outputDir, "tmp-build");
    mkdirSync(temporaryArtifactDir);
    writeFileSync(join(temporaryArtifactDir, "scratch.js"), "temporary", "utf8");

    try {
      const article = await articleService.createArticle("# Growth note\n\nRevenue grew from 10 to 20.");
      const unit = createBuildUnit(article.id, article.version, article.blocks[1]?.id ?? article.blocks[0]!.id);
      insertGeneratedSpecFixture(db, unit);

      const record = await runExportNode({
        article,
        buildUnits: [unit],
        componentLibraryVersion: "0.1.0",
        createId: () => "export_1",
        db,
        now: () => new Date("2026-06-14T00:00:00.000Z"),
        outputDir,
        qaRecords: [createQARecord(article.id, article.version, unit.specId, "passed")],
        temporaryArtifactPaths: [temporaryArtifactDir],
        validationRecords: [createValidationRecord(article.id, article.version, unit.specId, "passed")]
      });

      expect(record).toMatchObject({
        articleId: article.id,
        createdAt: "2026-06-14T00:00:00.000Z",
        documentVersion: article.version,
        id: "export_1",
        manifest: expect.objectContaining({ articleId: article.id, exportId: "export_1" })
      });
      expect(record.payload.artifacts.map((artifact) => artifact.path).sort()).toEqual(["manifest.json", "preview.html", `${record.payload.tagName}.js`].sort());
      expect(readFileSync(join(record.payload.exportDir, "manifest.json"), "utf8")).toContain('"exportId": "export_1"');
      expect(existsSync(temporaryArtifactDir)).toBe(false);
      expect(getExportRecord(db, "export_1")).toEqual(record);
    } finally {
      db.close();
    }
  });

  it("blocks export when static validation failed", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = createBuildUnit(article.id, article.version, article.blocks[0]!.id);

      await expect(
        runExportNode({
          article,
          buildUnits: [unit],
          componentLibraryVersion: "0.1.0",
          createId: () => "export_1",
          db,
          outputDir: createTempDirectory("banderdash-export-node-output-"),
          qaRecords: [createQARecord(article.id, article.version, unit.specId, "passed")],
          validationRecords: [createValidationRecord(article.id, article.version, unit.specId, "failed")]
        })
      ).rejects.toThrow(ExportEligibilityError);

      expect(getExportRecord(db, "export_1")).toBeNull();
    } finally {
      db.close();
    }
  });

  it("requires explicit QA confirmation for warning or crashed QA records", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });
    const outputDir = createTempDirectory("banderdash-export-node-output-");

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const unit = createBuildUnit(article.id, article.version, article.blocks[0]!.id);

      await expect(
        runExportNode({
          article,
          buildUnits: [unit],
          componentLibraryVersion: "0.1.0",
          createId: () => "export_blocked",
          db,
          outputDir,
          qaRecords: [createQARecord(article.id, article.version, unit.specId, "warning")],
          validationRecords: [createValidationRecord(article.id, article.version, unit.specId, "passed")]
        })
      ).rejects.toThrow(ExportEligibilityError);

      const allowed = await runExportNode({
        article,
        buildUnits: [unit],
        componentLibraryVersion: "0.1.0",
        createId: () => "export_allowed",
        db,
        outputDir,
        qaOverrideConfirmed: true,
        qaRecords: [createQARecord(article.id, article.version, unit.specId, "warning")],
        validationRecords: [createValidationRecord(article.id, article.version, unit.specId, "passed")]
      });

      expect(allowed.id).toBe("export_allowed");
    } finally {
      db.close();
    }
  });

  it("rejects build units from stale article versions", async () => {
    const db = createMigratedDatabase();
    const articleService = createArticleService({ createId: () => "article_test_1", db });

    try {
      const article = await articleService.createArticle("Revenue grew from 10 to 20.");
      const staleUnit = createBuildUnit(article.id, article.version - 1, article.blocks[0]!.id);

      await expect(
        runExportNode({
          article,
          buildUnits: [staleUnit],
          componentLibraryVersion: "0.1.0",
          db,
          outputDir: createTempDirectory("banderdash-export-node-output-"),
          qaRecords: [createQARecord(article.id, article.version, staleUnit.specId, "passed")],
          validationRecords: [createValidationRecord(article.id, article.version, staleUnit.specId, "passed")]
        })
      ).rejects.toThrow(/does not match the current article version/);
    } finally {
      db.close();
    }
  });
});

function createBuildUnit(articleId: string, documentVersion: number, blockId: string): LibraryBuildUnit {
  return {
    accessibilityNotes: "Labelled range input with text result.",
    articleId,
    candidateId: "candidate_1",
    componentName: "ReactiveValue",
    componentPath: "packages/components/src/ReactiveValue.svelte",
    documentVersion,
    embeddedData: { blockIds: [blockId] },
    fallbackText: "Revenue doubled from 10 to 20.",
    id: "build_spec_1",
    mode: "library",
    props: {},
    reducedMotionRequirements: "No animation required.",
    specId: "spec_1"
  };
}

function createValidationRecord(articleId: string, documentVersion: number, generatedSpecId: string, status: "passed" | "failed"): StaticValidationRecord {
  return {
    articleId,
    documentVersion,
    generatedSpecId,
    id: `validation_${generatedSpecId}`,
    result: { hardFailures: status === "failed" ? [{ code: "BLOCKED", message: "blocked" }] : [], ok: status === "passed", warnings: [] },
    status
  };
}

function createQARecord(articleId: string, documentVersion: number, generatedSpecId: string, status: "passed" | "warning" | "crashed"): SandboxQARecord {
  return {
    articleId,
    documentVersion,
    generatedSpecId,
    id: `qa_${generatedSpecId}`,
    result: {
      findings:
        status === "passed"
          ? []
          : [
              {
                code: "QA_WARNING",
                message: "Needs confirmation.",
                severity: status === "crashed" ? "crash" : "warning"
              }
            ],
      ok: status !== "crashed"
    },
    status
  };
}

function insertGeneratedSpecFixture(db: BanderdashDatabase, unit: LibraryBuildUnit): void {
  const blockIds = unit.embeddedData.blockIds;
  const firstBlockId = Array.isArray(blockIds) && typeof blockIds[0] === "string" ? blockIds[0] : null;

  db.prepare(
    `insert into candidates (id, article_id, document_version, block_id, status, payload_json)
      values (?, ?, ?, ?, 'survived', '{}')`
  ).run(unit.candidateId, unit.articleId, unit.documentVersion, firstBlockId);
  db.prepare(
    `insert into generated_specs (id, candidate_id, article_id, document_version, payload_json)
      values (?, ?, ?, ?, '{}')`
  ).run(unit.specId, unit.candidateId, unit.articleId, unit.documentVersion);
}
