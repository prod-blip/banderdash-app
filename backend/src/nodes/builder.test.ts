import { describe, expect, it } from "vitest";
import type { ComponentSpec } from "./schemas/componentSpec.js";
import { BuilderValidationError, runLibraryBuilderNode } from "./builder.js";

const validSpec: ComponentSpec = {
  id: "spec_1",
  candidateId: "candidate_1",
  articleId: "article_1",
  documentVersion: 1,
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
  reducedMotionRequirements: "No animation required."
};

describe("library Builder node", () => {
  it("converts a valid ReactiveValue spec into an audited library build unit", () => {
    const units = runLibraryBuilderNode({ specs: [validSpec] });

    expect(units).toEqual([
      {
        id: "build_spec_1",
        specId: "spec_1",
        candidateId: "candidate_1",
        articleId: "article_1",
        documentVersion: 1,
        mode: "library",
        componentName: "ReactiveValue",
        componentPath: "packages/components/src/ReactiveValue.svelte",
        props: validSpec.props,
        embeddedData: validSpec.embeddedData,
        fallbackText: "Revenue doubled from 10 to 20.",
        accessibilityNotes: "Labelled range input with text result.",
        reducedMotionRequirements: "No animation required."
      }
    ]);
  });

  it("fails invalid audited component props before building", () => {
    const invalidSpec: ComponentSpec = {
      ...validSpec,
      props: { ...validSpec.props, min: 100, max: 0 }
    };

    expect(() => runLibraryBuilderNode({ specs: [invalidSpec] })).toThrow(BuilderValidationError);
    expect(() => runLibraryBuilderNode({ specs: [invalidSpec] })).toThrow("invalid props");
  });

  it("fails unsupported components instead of drifting into bespoke generation", () => {
    const unsupportedSpec: ComponentSpec = {
      ...validSpec,
      componentName: "CompareToggle"
    };

    expect(() => runLibraryBuilderNode({ specs: [unsupportedSpec] })).toThrow(BuilderValidationError);
    expect(() => runLibraryBuilderNode({ specs: [unsupportedSpec] })).toThrow("unsupported component CompareToggle");
  });

  it("returns no build units when there are no generated specs", () => {
    expect(runLibraryBuilderNode({ specs: [] })).toEqual([]);
  });
});
