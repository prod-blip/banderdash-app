import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { componentRegistry, getComponentByName, getComponentByPattern } from "./registry.js";
import { isCompareToggleProps, type CompareToggleProps } from "./compareToggle.schema.js";

const validProps: CompareToggleProps = {
  label: "Compare two policy paths",
  description: "Toggle between the two states to see why the distinction matters.",
  optionA: {
    id: "a",
    label: "Before",
    heading: "Before the change",
    body: "Readers only see the baseline outcome and miss the tradeoff."
  },
  optionB: {
    id: "b",
    label: "After",
    heading: "After the change",
    body: "Readers can compare the alternative outcome against the baseline."
  },
  fallbackText: "The comparison changes the conclusion because the two states produce different outcomes."
};

describe("CompareToggle audited component path", () => {
  it("registers CompareToggle by compare_toggle pattern and name", () => {
    expect(componentRegistry).toHaveLength(2);
    expect(getComponentByPattern("compare_toggle")).toMatchObject({
      name: "CompareToggle",
      componentPath: "packages/components/src/CompareToggle.svelte"
    });
    expect(getComponentByName("CompareToggle")?.validateProps(validProps)).toBe(true);
  });

  it("accepts valid A/B comparison props", () => {
    expect(isCompareToggleProps(validProps)).toBe(true);
  });

  it("requires fallback text and non-empty comparison copy", () => {
    expect(isCompareToggleProps({ ...validProps, fallbackText: "" })).toBe(false);
    expect(isCompareToggleProps({ ...validProps, optionA: { ...validProps.optionA, body: "" } })).toBe(false);
  });

  it("requires fixed A/B option identifiers", () => {
    expect(isCompareToggleProps({ ...validProps, optionA: { ...validProps.optionA, id: "b" } })).toBe(false);
    expect(isCompareToggleProps({ ...validProps, optionB: { ...validProps.optionB, id: "a" } })).toBe(false);
  });

  it("keeps the Svelte component in the safe audited subset with keyboard-reachable controls", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "CompareToggle.svelte"), "utf8");

    expect(source).not.toContain("{@html");
    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("new Function");
    expect(source).not.toMatch(/\beval\s*\(/u);
    expect(source).toContain("<button");
    expect(source).toContain("aria-pressed");
    expect(source).toContain("aria-live");
  });
});
