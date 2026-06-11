import { describe, expect, it } from "vitest";
import { isSandboxPreviewRequest, MAX_PREVIEW_MESSAGE_BYTES, renderPreviewMarkup } from "./renderer.js";

describe("sandbox renderer protocol", () => {
  it("accepts bounded preview messages with component, props, and safe run id", () => {
    expect(isSandboxPreviewRequest({ component: "ReactiveValue", props: { label: "Revenue" }, runId: "run_123" })).toBe(true);
  });

  it("rejects missing or malformed payloads", () => {
    expect(isSandboxPreviewRequest(null)).toBe(false);
    expect(isSandboxPreviewRequest({ component: "ReactiveValue", props: [], runId: "run_123" })).toBe(false);
    expect(isSandboxPreviewRequest({ component: "ReactiveValue", props: {}, runId: "../bad" })).toBe(false);
  });

  it("rejects oversized preview messages", () => {
    expect(isSandboxPreviewRequest({ component: "ReactiveValue", props: { data: "x".repeat(MAX_PREVIEW_MESSAGE_BYTES) }, runId: "run_123" })).toBe(false);
  });

  it("escapes rendered placeholder markup", () => {
    const markup = renderPreviewMarkup({ component: "<script>alert(1)</script>", props: { label: "<b>bad</b>" }, runId: "run_123" });

    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markup).toContain("&lt;b&gt;bad&lt;/b&gt;");
    expect(markup).not.toContain("<script>");
  });
});
