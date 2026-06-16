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

describe("Full ReactiveValue library flow", () => {
  it("persists an article, pauses for consent, approves, validates, QA-checks, and exports a manifest", async () => {
    flowResult = await runFullLibraryFlow({
      articleText: "# Pricing sensitivity\n\nIf monthly usage doubles from 10 to 20 projects, the support load doubles too.",
      candidateId: "candidate_reactive_1",
      createCandidate: createReactiveValueCandidate,
      createSpec: createReactiveValueSpec,
      exportId: "export_reactive_1",
      tempPrefix: "banderdash-full-reactive-flow-"
    });

    expect(flowResult.article.id).toBe("article_candidate_reactive_1");
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
        candidateId: "candidate_reactive_1",
        componentName: "ReactiveValue",
        componentPath: "packages/components/src/ReactiveValue.svelte",
        mode: "library"
      }
    ]);
    expect(flowResult.validationRecords).toMatchObject([{ generatedSpecId: "spec_reactive_1", status: "passed" }]);
    expect(flowResult.qaRecords).toMatchObject([{ generatedSpecId: "spec_reactive_1", status: "passed" }]);
    expect(flowResult.exportRecord.manifest).toMatchObject({
      articleId: flowResult.article.id,
      exportId: "export_reactive_1",
      interactions: [{ componentName: "ReactiveValue", id: "candidate_reactive_1", mode: "library" }]
    });
    expect(flowResult.exportRecord.payload.artifacts.map((artifact) => artifact.path).sort()).toEqual(
      ["manifest.json", "preview.html", `${flowResult.exportRecord.payload.tagName}.js`].sort()
    );
    expect(existsSync(join(flowResult.exportRecord.payload.exportDir, "manifest.json"))).toBe(true);
  });
});

function createReactiveValueCandidate(article: ArticleDoc): InteractionCandidate {
  const blockId = article.blocks.find((block) => block.type === "paragraph")?.id ?? article.blocks[0]!.id;
  return {
    articleId: article.id,
    blockIds: [blockId],
    documentVersion: article.version,
    id: "candidate_reactive_1",
    libraryRepresentable: true,
    pattern: "ReactiveValue",
    rationale: "The paragraph describes a numeric doubling relationship that readers can vary directly.",
    requiredData: ["10 projects", "20 projects"],
    spanIds: [],
    status: "proposed",
    understandingLossIfRemoved: "Readers lose the ability to test how doubling usage changes support load."
  };
}

function createReactiveValueSpec(article: ArticleDoc, candidate: InteractionCandidate): ComponentSpec {
  return {
    accessibilityNotes: "Labelled range input with a polite live result.",
    articleId: article.id,
    candidateId: candidate.id,
    componentName: "ReactiveValue",
    documentVersion: article.version,
    embeddedData: { sourceBlockIds: candidate.blockIds },
    fallbackText: "Doubling usage from 10 to 20 projects doubles support load.",
    id: "spec_reactive_1",
    mode: "library",
    props: {
      calculation: { operation: "multiply", operand: 2, precision: 0 },
      description: "Adjust usage to see the doubled support load.",
      fallbackText: "Doubling usage from 10 to 20 projects doubles support load.",
      initialValue: 10,
      label: "Usage projects",
      max: 40,
      min: 0,
      resultLabel: "Support load index",
      step: 1,
      unit: "projects"
    },
    reducedMotionRequirements: "No animation required."
  };
}
