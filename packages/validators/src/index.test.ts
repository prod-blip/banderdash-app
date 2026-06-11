import { describe, expect, it } from "vitest";
import { createValidationResult, type ValidationFinding, type ValidationResult } from "./index.js";

describe("validator result shape", () => {
  it("creates a passing validation result when there are no hard failures", () => {
    const result: ValidationResult = createValidationResult();

    expect(result).toEqual({ ok: true, hardFailures: [], warnings: [] });
  });

  it("keeps warnings without failing the validation result", () => {
    const warnings: ValidationFinding[] = [{ code: "MISSING_LABEL", message: "Add a clearer label." }];

    expect(createValidationResult({ warnings })).toEqual({ ok: true, hardFailures: [], warnings });
  });

  it("marks the validation result as failed when hard failures exist", () => {
    const hardFailures: ValidationFinding[] = [{ code: "NETWORK_API", message: "Runtime network APIs are not allowed." }];

    expect(createValidationResult({ hardFailures })).toEqual({ ok: false, hardFailures, warnings: [] });
  });
});
