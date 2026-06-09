import { describe, expect, it } from "vitest";
import { createFakeProvider } from "./fake.js";
import { runProviderPreflight } from "./preflight.js";

describe("runProviderPreflight", () => {
  it("passes required provider checks when capabilities satisfy the MVP", async () => {
    const report = await runProviderPreflight(createFakeProvider(), {
      model: "fake-model",
      requiresStructuredOutput: true,
      requiresStreaming: true,
      minContextWindowTokens: 8_000
    });

    expect(report.ok).toBe(true);
    expect(report.checks.map((check) => [check.id, check.status])).toEqual([
      ["provider-auth", "pass"],
      ["provider-model", "pass"],
      ["provider-structured-output", "pass"],
      ["provider-streaming", "pass"],
      ["provider-context-window", "pass"]
    ]);
  });

  it("fails when auth check fails", async () => {
    const report = await runProviderPreflight(createFakeProvider({ authOk: false, authMessage: "missing token" }), {
      model: "fake-model"
    });

    expect(report.ok).toBe(false);
    expect(report.checks).toContainEqual({
      id: "provider-auth",
      label: "Provider auth",
      status: "fail",
      message: "missing token"
    });
  });

  it("fails when the configured model is unavailable", async () => {
    const report = await runProviderPreflight(createFakeProvider(), { model: "missing-model" });

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "provider-model")?.status).toBe("fail");
  });

  it("fails when structured output is required but unsupported", async () => {
    const report = await runProviderPreflight(
      createFakeProvider({ capabilities: { supportsStructuredOutput: false } }),
      { model: "fake-model", requiresStructuredOutput: true }
    );

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "provider-structured-output")?.status).toBe("fail");
  });

  it("fails when streaming is required but unsupported", async () => {
    const report = await runProviderPreflight(createFakeProvider({ capabilities: { supportsStreaming: false } }), {
      model: "fake-model",
      requiresStreaming: true
    });

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "provider-streaming")?.status).toBe("fail");
  });

  it("fails when the context window is too small", async () => {
    const report = await runProviderPreflight(createFakeProvider({ capabilities: { contextWindowTokens: 4_000 } }), {
      model: "fake-model",
      minContextWindowTokens: 8_000
    });

    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.id === "provider-context-window")?.status).toBe("fail");
  });
});
