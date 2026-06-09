import { describe, expect, it } from "vitest";
import { isInteractionCandidate, isInteractionCandidateSet, interactionCandidateJsonSchema } from "./candidate.js";

const validCandidate = {
  id: "candidate_1",
  articleId: "article_1",
  documentVersion: 1,
  blockIds: ["block_1"],
  spanIds: [],
  pattern: "ReactiveValue",
  rationale: "The paragraph explains a changing numeric relationship.",
  requiredData: ["baseline value"],
  libraryRepresentable: true,
  understandingLossIfRemoved: "Readers lose the ability to test how the number changes the conclusion.",
  status: "proposed"
};

describe("interaction candidate schema", () => {
  it("accepts a complete candidate and candidate set", () => {
    expect(isInteractionCandidate(validCandidate)).toBe(true);
    expect(isInteractionCandidateSet({ candidates: [validCandidate] })).toBe(true);
  });

  it("rejects missing block IDs", () => {
    expect(isInteractionCandidate({ ...validCandidate, blockIds: [] })).toBe(false);
  });

  it("rejects unsupported patterns", () => {
    expect(isInteractionCandidate({ ...validCandidate, pattern: "DecorativeSparkles" })).toBe(false);
  });

  it("rejects candidates without rationale", () => {
    expect(isInteractionCandidate({ ...validCandidate, rationale: "" })).toBe(false);
  });

  it("exposes a provider JSON schema for structured output", () => {
    expect(interactionCandidateJsonSchema).toMatchObject({
      type: "object",
      required: ["candidates"],
      properties: {
        candidates: {
          type: "array"
        }
      }
    });
  });
});
