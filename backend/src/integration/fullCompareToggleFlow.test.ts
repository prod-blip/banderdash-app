import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ArticleDoc } from "@banderdash/doc-model";
import type { InteractionCandidate } from "../nodes/schemas/candidate.js";
import type { ComponentSpec } from "../nodes/schemas/componentSpec.js";
import { cleanupFullLibraryFlowResult, runFullLibraryFlow, type FullLibraryFlowResult } from "./fullFlowTestHarness.js";

let flowResult: FullLibraryFlowResult | null = null;

afterEach(() => {
  cleanupFullLibraryFlowResult(flowResult);
  flowResult = null;
});

describe("Full CompareToggle library flow", () => {
  it("persists an article, pauses for consent, approves, validates, QA-checks, and exports a manifest", async () => {
    flowResult = await runFullLibraryFlow({
      articleText: "# Publishing tradeoffs\n\nLocal-first exports preserve writer and reader control, while hosted embeds optimize distribution reach.",
      candidateId: "candidate_compare_1",
      createCandidate: createCompareToggleCandidate,
      createSpec: createCompareToggleSpec,
      exportId: "export_compare_1",
      tempPrefix: "banderdash-full-compare-flow-"
    });

    expect(flowResult.article.id).toBe("article_candidate_compare_1");
    expect(flowResult.pausedRun).toMatchObject({
      completedStages: ["Structurer", "Analyst", "Critic"],
      currentStage: "ConsentDataGap",
      status: "waiting_for_user"
    });
    expect(flowResult.completedRun).toMatchObject({
      completedStages: ["Structurer", "Analyst", "Critic", "ConsentDataGap", "SpecAgent", "Builder", "StaticValidator", "SandboxQA", "Export"],
      currentStage: null,
      status: "completed"
    });
    expect(flowResult.buildUnits).toMatchObject([
      {
        candidateId: "candidate_compare_1",
        componentName: "CompareToggle",
        componentPath: "packages/components/src/CompareToggle.svelte",
        mode: "library"
      }
    ]);
    expect(flowResult.validationRecords).toMatchObject([{ generatedSpecId: "spec_compare_1", status: "passed" }]);
    expect(flowResult.qaRecords).toMatchObject([{ generatedSpecId: "spec_compare_1", status: "passed" }]);
    expect(flowResult.exportRecord.manifest).toMatchObject({
      articleId: flowResult.article.id,
      exportId: "export_compare_1",
      interactions: [{ componentName: "CompareToggle", id: "candidate_compare_1", mode: "library" }]
    });
    expect(flowResult.exportRecord.payload.artifacts.map((artifact) => artifact.path).sort()).toEqual(
      ["manifest.json", "preview.html", `${flowResult.exportRecord.payload.tagName}.js`].sort()
    );
    expect(existsSync(join(flowResult.exportRecord.payload.exportDir, "manifest.json"))).toBe(true);
  });
});

function createCompareToggleCandidate(article: ArticleDoc): InteractionCandidate {
  const blockId = article.blocks.find((block) => block.type === "paragraph")?.id ?? article.blocks[0]!.id;
  return {
    articleId: article.id,
    blockIds: [blockId],
    documentVersion: article.version,
    id: "candidate_compare_1",
    libraryRepresentable: true,
    pattern: "compare_toggle",
    rationale: "The paragraph contrasts two publishing models that readers need to compare one side at a time.",
    requiredData: ["local-first exports", "hosted embeds"],
    spanIds: [],
    status: "proposed",
    understandingLossIfRemoved: "Readers lose the explicit toggled contrast between control and distribution reach."
  };
}

function createCompareToggleSpec(article: ArticleDoc, candidate: InteractionCandidate): ComponentSpec {
  return {
    accessibilityNotes: "Two keyboard-reachable buttons toggle the focused comparison side.",
    articleId: article.id,
    candidateId: candidate.id,
    componentName: "CompareToggle",
    documentVersion: article.version,
    embeddedData: { sourceBlockIds: candidate.blockIds },
    fallbackText: "Local-first exports preserve control; hosted embeds optimize distribution reach.",
    id: "spec_compare_1",
    mode: "library",
    props: {
      description: "Compare the two publishing tradeoffs from the article.",
      fallbackText: "Local-first exports preserve control; hosted embeds optimize distribution reach.",
      label: "Compare publishing paths",
      optionA: {
        body: "Local-first exports keep the artifact portable and preserve writer and reader control.",
        heading: "Local-first exports",
        id: "a",
        label: "Local-first"
      },
      optionB: {
        body: "Hosted embeds make distribution easier but shift control to the hosted service.",
        heading: "Hosted embeds",
        id: "b",
        label: "Hosted"
      }
    },
    reducedMotionRequirements: "No animation required."
  };
}
