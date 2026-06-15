import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFakeProvider } from "@banderdash/providers";
import { afterEach, describe, expect, it } from "vitest";
import { createArticleService } from "../services/articles.js";
import { createCandidateConsentService } from "../services/candidateConsent.js";
import { connectDatabase, type BanderdashDatabase } from "../services/db.js";
import { createExportRecord } from "../services/exports.js";
import { runMigrations } from "../services/migrations.js";
import { runAnalystNode } from "./analyst.js";
import { runLibraryBuilderNode } from "./builder.js";
import { runCriticNode } from "./critic.js";
import { runSandboxQANode } from "./sandboxQA.js";
import type { ComponentSpec } from "./schemas/componentSpec.js";
import { runSpecAgentNode } from "./specAgent.js";
import { runStaticValidatorNode } from "./staticValidator.js";

const tempDirectories: string[] = [];

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "banderdash-compare-flow-test-"));
  tempDirectories.push(directory);
  return directory;
}

function createMigratedDatabase(directory: string): BanderdashDatabase {
  const db = connectDatabase({ sqlitePath: join(directory, "state", "banderdash.sqlite") });
  runMigrations(db);
  return db;
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("CompareToggle workflow path", () => {
  it("turns a comparison candidate into a validated export record", async () => {
    const directory = createTempDirectory();
    const db = createMigratedDatabase(directory);
    const articleService = createArticleService({ createId: () => "article_compare_1", db });

    try {
      const article = await articleService.createArticle("Local-first exports versus hosted embeds: the first preserves reader control while the second optimizes distribution.");
      const blockId = article.blocks[0]?.id ?? "missing";
      const candidate = {
        articleId: article.id,
        blockIds: [blockId],
        documentVersion: article.version,
        id: "candidate_compare_1",
        libraryRepresentable: true,
        pattern: "compare_toggle",
        rationale: "The sentence contrasts two publishing models that are easier to understand one at a time.",
        requiredData: ["local-first exports", "hosted embeds"],
        spanIds: [],
        status: "proposed",
        understandingLossIfRemoved: "Readers lose the explicit back-and-forth between the two publishing models."
      } as const;

      const proposedCandidates = await runAnalystNode({
        article,
        db,
        model: "fake-model",
        provider: createFakeProvider({ structuredValue: { candidates: [candidate] } })
      });
      expect(proposedCandidates).toMatchObject([{ pattern: "compare_toggle" }]);

      const survivedCandidates = await runCriticNode({
        article,
        candidates: proposedCandidates,
        db,
        model: "fake-model",
        provider: createFakeProvider({ structuredValue: { candidates: proposedCandidates.map((entry) => ({ ...entry, status: "survived" })) } })
      });
      expect(survivedCandidates).toMatchObject([{ status: "survived" }]);

      createCandidateConsentService({ createId: () => "approval_compare_1", db }).recordConsent({
        articleId: article.id,
        candidateId: candidate.id,
        decision: "approved",
        expectedVersion: article.version
      });

      const spec = createCompareToggleSpec(article.id, article.version, candidate.id);
      const specs = await runSpecAgentNode({
        article,
        candidates: survivedCandidates,
        db,
        model: "fake-model",
        provider: createFakeProvider({ structuredValue: { specs: [spec] } })
      });
      expect(specs).toMatchObject([{ componentName: "CompareToggle" }]);

      const buildUnits = runLibraryBuilderNode({ specs });
      expect(buildUnits).toMatchObject([{ componentName: "CompareToggle", componentPath: "packages/components/src/CompareToggle.svelte" }]);

      const componentSourceByPath = { "packages/components/src/CompareToggle.svelte": readComponentSource("packages/components/src/CompareToggle.svelte") };
      const validationRecords = runStaticValidatorNode({ buildUnits, componentSourceByPath, db });
      expect(validationRecords).toMatchObject([{ status: "passed" }]);

      const qaRecords = runSandboxQANode({ buildUnits, componentSourceByPath, db });
      const outputDir = join(directory, "exports");
      mkdirSync(outputDir, { recursive: true });
      const exportRecord = await createExportRecord({
        article,
        buildUnits,
        componentLibraryVersion: "0.1.0",
        createId: () => "export_compare_1",
        db,
        outputDir,
        qaOverrideConfirmed: true,
        qaRecords,
        validationRecords
      });

      expect(exportRecord.payload.artifacts.map((artifact) => artifact.path)).toContain("manifest.json");
      expect(exportRecord.manifest.interactions).toMatchObject([{ componentName: "CompareToggle", mode: "library" }]);
    } finally {
      db.close();
    }
  });
});

function createCompareToggleSpec(articleId: string, documentVersion: number, candidateId: string): ComponentSpec {
  return {
    accessibilityNotes: "Two keyboard-reachable buttons toggle the focused comparison side.",
    articleId,
    candidateId,
    componentName: "CompareToggle",
    documentVersion,
    embeddedData: { sourceBlockIds: ["block_1"] },
    fallbackText: "Local-first exports preserve reader control; hosted embeds optimize distribution.",
    id: "spec_compare_1",
    mode: "library",
    props: {
      description: "Compare two publishing models from the source sentence.",
      fallbackText: "Local-first exports preserve reader control; hosted embeds optimize distribution.",
      label: "Compare publishing models",
      optionA: {
        body: "Local-first exports preserve reader control.",
        heading: "Local-first exports",
        id: "a",
        label: "Local-first"
      },
      optionB: {
        body: "Hosted embeds optimize distribution.",
        heading: "Hosted embeds",
        id: "b",
        label: "Hosted"
      }
    },
    reducedMotionRequirements: "No animation required."
  };
}

function readComponentSource(componentPath: string): string {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  return readFileSync(join(repoRoot, componentPath), "utf8");
}
