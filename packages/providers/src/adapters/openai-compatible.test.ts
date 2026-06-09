import { describe, expect, it } from "vitest";
import { createOpenAICompatibleProvider, createOpenAICompatibleProviderFromEnv } from "./openai-compatible.js";

interface CapturedRequest {
  url: string;
  init: RequestInit;
}

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" }
  });
}

function createFetchMock(handler: (request: CapturedRequest) => Response): { fetch: typeof fetch; requests: CapturedRequest[] } {
  const requests: CapturedRequest[] = [];
  return {
    requests,
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      const request = { url: String(url), init: init ?? {} };
      requests.push(request);
      return handler(request);
    }) as typeof fetch
  };
}

describe("createOpenAICompatibleProvider", () => {
  it("reports missing API key as failed auth without making a network request", async () => {
    const fetchMock = createFetchMock(() => jsonResponse({ data: [] }));
    const provider = createOpenAICompatibleProvider({ apiKey: undefined, fetch: fetchMock.fetch });

    await expect(provider.checkAuth()).resolves.toEqual({
      ok: false,
      message: "OPENAI_COMPATIBLE_API_KEY or OPENAI_API_KEY must be set for openai-compatible provider"
    });
    expect(fetchMock.requests).toEqual([]);
  });

  it("loads model capabilities through the OpenAI-compatible models endpoint", async () => {
    const fetchMock = createFetchMock(() => jsonResponse({ data: [{ id: "gpt-test" }] }));
    const provider = createOpenAICompatibleProvider({ apiKey: "test-key", baseUrl: "https://example.test/v1/", fetch: fetchMock.fetch });

    await expect(provider.checkAuth()).resolves.toEqual({ ok: true, message: "provider reachable; 1 model(s) available" });
    await expect(provider.capabilities()).resolves.toMatchObject({
      models: ["gpt-test"],
      supportsStructuredOutput: true,
      supportsStreaming: true
    });
    expect(fetchMock.requests[0]?.url).toBe("https://example.test/v1/models");
    expect(fetchMock.requests[0]?.init.headers).toMatchObject({ Authorization: "Bearer test-key" });
  });

  it("maps chat completions to provider results", async () => {
    const fetchMock = createFetchMock((request) => {
      expect(request.url).toBe("https://example.test/v1/chat/completions");
      expect(JSON.parse(String(request.init.body))).toMatchObject({
        model: "gpt-test",
        messages: [{ role: "user", content: "hello" }]
      });
      return jsonResponse({
        model: "gpt-test",
        choices: [{ message: { content: "world" } }],
        usage: { prompt_tokens: 3, completion_tokens: 2 }
      });
    });
    const provider = createOpenAICompatibleProvider({ apiKey: "test-key", baseUrl: "https://example.test/v1", fetch: fetchMock.fetch });

    await expect(
      provider.complete({ model: "gpt-test", messages: [{ role: "user", content: "hello" }] })
    ).resolves.toEqual({ content: "world", model: "gpt-test", usage: { inputTokens: 3, outputTokens: 2 } });
  });

  it("requests JSON schema structured output and validates parsed content", async () => {
    const fetchMock = createFetchMock((request) => {
      expect(JSON.parse(String(request.init.body))).toMatchObject({
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "answer",
            schema: { type: "object", properties: { answer: { type: "number" } } },
            strict: true
          }
        }
      });
      return jsonResponse({ choices: [{ message: { content: "{\"answer\":42}" } }] });
    });
    const provider = createOpenAICompatibleProvider({ apiKey: "test-key", baseUrl: "https://example.test/v1", fetch: fetchMock.fetch });

    await expect(
      provider.structured<{ answer: number }>({
        model: "gpt-test",
        messages: [{ role: "user", content: "answer" }],
        schema: { name: "answer", jsonSchema: { type: "object", properties: { answer: { type: "number" } } } },
        validate: (value): value is { answer: number } =>
          typeof value === "object" && value !== null && "answer" in value && typeof value.answer === "number"
      })
    ).resolves.toMatchObject({ value: { answer: 42 } });
  });

  it("parses OpenAI-compatible streaming deltas", async () => {
    const fetchMock = createFetchMock((request) => {
      expect(JSON.parse(String(request.init.body))).toMatchObject({ stream: true });
      return new Response([
        "data: {\"choices\":[{\"delta\":{\"content\":\"hel\"}}]}",
        "data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}",
        "data: [DONE]"
      ].join("\n"));
    });
    const provider = createOpenAICompatibleProvider({ apiKey: "test-key", baseUrl: "https://example.test/v1", fetch: fetchMock.fetch });

    const chunks = [];
    for await (const chunk of provider.stream?.({ model: "gpt-test", messages: [{ role: "user", content: "hello" }] }) ?? []) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { contentDelta: "hel", done: false },
      { contentDelta: "lo", done: false },
      { contentDelta: "", done: true }
    ]);
  });

  it("creates adapter config from env without exposing secrets", async () => {
    const provider = createOpenAICompatibleProviderFromEnv({
      OPENAI_COMPATIBLE_API_KEY: "secret",
      OPENAI_COMPATIBLE_BASE_URL: "https://example.test/v1"
    });

    expect(provider.name).toBe("openai-compatible");
  });
});
