import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { componentRegistry, getComponentByName, getComponentByPattern } from "./registry.js";
import { computeReactiveValue, isReactiveValueProps, type ReactiveValueProps } from "./reactiveValue.schema.js";

const validProps: ReactiveValueProps = {
  label: "Explore revenue growth",
  description: "Move the input to see the projected value.",
  initialValue: 10,
  min: 0,
  max: 20,
  step: 1,
  unit: "%",
  calculation: {
    operation: "multiply",
    operand: 2,
    precision: 0
  },
  resultLabel: "Projected growth",
  fallbackText: "Revenue growth changes the conclusion when it doubles."
};

describe("ReactiveValue audited component path", () => {
  it("registers ReactiveValue by pattern and name", () => {
    expect(componentRegistry).toHaveLength(1);
    expect(getComponentByPattern("ReactiveValue")).toMatchObject({
      name: "ReactiveValue",
      componentPath: "packages/components/src/ReactiveValue.svelte"
    });
    expect(getComponentByName("ReactiveValue")?.validateProps(validProps)).toBe(true);
  });

  it("accepts valid numeric props and computes a bounded reactive value", () => {
    expect(isReactiveValueProps(validProps)).toBe(true);
    expect(computeReactiveValue(validProps, 12)).toBe(24);
  });

  it("rejects formula strings and unsupported calculation operations", () => {
    expect(
      isReactiveValueProps({
        ...validProps,
        calculation: { formula: "value * window.secret" }
      })
    ).toBe(false);
    expect(
      isReactiveValueProps({
        ...validProps,
        calculation: { operation: "eval", operand: 2 }
      })
    ).toBe(false);
  });

  it("requires fallback text", () => {
    expect(isReactiveValueProps({ ...validProps, fallbackText: "" })).toBe(false);
  });

  it("keeps the Svelte component in the safe audited subset", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "ReactiveValue.svelte"), "utf8");

    expect(source).not.toContain("{@html");
    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("new Function");
    expect(source).not.toMatch(/\beval\s*\(/u);
    expect(source).toContain('type="range"');
    expect(source).toContain("aria-live");
  });
});
