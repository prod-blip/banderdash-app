import { describe, expect, it } from "vitest";
import { createFakeProvider } from "./fake.js";

describe("createFakeProvider", () => {
  it("implements deterministic completion and structured calls", async () => {
    const provider = createFakeProvider({ structuredValue: { answer: 42 } });

    await expect(
      provider.complete({ model: "fake-model", messages: [{ role: "user", content: "hello" }] })
    ).resolves.toMatchObject({ content: "hello", model: "fake-model" });

    await expect(
      provider.structured<{ answer: number }>({
        model: "fake-model",
        messages: [{ role: "user", content: "answer" }],
        schema: { name: "answer", jsonSchema: { type: "object" } },
        validate: (value): value is { answer: number } =>
          typeof value === "object" && value !== null && "answer" in value && typeof value.answer === "number"
      })
    ).resolves.toMatchObject({ value: { answer: 42 } });
  });

  it("can simulate failed auth for preflight tests", async () => {
    const provider = createFakeProvider({ authOk: false, authMessage: "missing token" });

    await expect(provider.checkAuth()).resolves.toEqual({ ok: false, message: "missing token" });
  });
});
