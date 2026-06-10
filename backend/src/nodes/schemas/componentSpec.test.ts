import { describe, expect, it } from "vitest";
import {
  componentSpecJsonSchema,
  isComponentSpec,
  isComponentSpecSet,
  validateLibraryComponentSpec,
  type ComponentSpec
} from "./componentSpec.js";

const validSpec: ComponentSpec = {
  id: "spec_1",
  candidateId: "candidate_1",
  articleId: "article_1",
  documentVersion: 1,
  mode: "library",
  componentName: "ReactiveValue",
  props: {
    label: "Pricing change",
    initialValue: 10,
    min: 0,
    max: 100,
    step: 1,
    calculation: { operation: "multiply", operand: 2, precision: 0 },
    resultLabel: "Revenue impact",
    fallbackText: "Revenue doubled from 10 to 20."
  },
  embeddedData: { sourceBlockIds: ["block_1"] },
  fallbackText: "Revenue doubled from 10 to 20.",
  accessibilityNotes: "Uses a labelled range input and live result text.",
  reducedMotionRequirements: "No animation required."
};

describe("component spec schema", () => {
  it("accepts valid library component specs", () => {
    expect(isComponentSpec(validSpec)).toBe(true);
    expect(isComponentSpecSet({ specs: [validSpec] })).toBe(true);
    expect(validateLibraryComponentSpec(validSpec)).toBe(true);
  });

  it("rejects specs without fallback text", () => {
    expect(isComponentSpec({ ...validSpec, fallbackText: "" })).toBe(false);
  });

  it("rejects unsupported components", () => {
    expect(validateLibraryComponentSpec({ ...validSpec, componentName: "UnknownComponent" })).toBe(false);
  });

  it("rejects invalid component props", () => {
    expect(validateLibraryComponentSpec({ ...validSpec, props: { ...validSpec.props, fallbackText: "" } })).toBe(false);
  });

  it("exposes a provider JSON schema for structured output", () => {
    expect(componentSpecJsonSchema.properties.specs.type).toBe("array");
  });
});
