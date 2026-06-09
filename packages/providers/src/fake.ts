import type {
  CallOpts,
  Chunk,
  LLMProvider,
  ProviderCapabilities,
  ProviderHealth,
  Result,
  StructuredCallOpts,
  StructuredResult
} from "./types.js";

export interface FakeProviderOptions {
  authOk?: boolean;
  authMessage?: string;
  capabilities?: Partial<ProviderCapabilities>;
  completion?: string;
  structuredValue?: unknown;
}

export function createFakeProvider(options: FakeProviderOptions = {}): LLMProvider {
  const capabilities: ProviderCapabilities = {
    models: ["fake-model"],
    supportsStructuredOutput: true,
    supportsStreaming: true,
    contextWindowTokens: 32_000,
    ...options.capabilities
  };
  const authOk = options.authOk ?? true;

  return {
    name: "fake",
    async capabilities(): Promise<ProviderCapabilities> {
      return capabilities;
    },
    async checkAuth(): Promise<ProviderHealth> {
      return {
        ok: authOk,
        message: options.authMessage ?? (authOk ? "fake provider ready" : "fake provider auth failed")
      };
    },
    async complete(callOptions: CallOpts): Promise<Result> {
      return {
        content: options.completion ?? callOptions.messages.at(-1)?.content ?? "",
        model: callOptions.model
      };
    },
    async structured<T = unknown>(callOptions: StructuredCallOpts<T>): Promise<StructuredResult<T>> {
      const value = (options.structuredValue ?? { ok: true }) as T;

      if (callOptions.validate && !callOptions.validate(value)) {
        throw new Error(`Fake provider structured value failed schema validation: ${callOptions.schema.name}`);
      }

      return {
        content: JSON.stringify(value),
        model: callOptions.model,
        value
      };
    },
    async *stream(callOptions: CallOpts): AsyncIterable<Chunk> {
      const content = options.completion ?? callOptions.messages.at(-1)?.content ?? "";
      yield { contentDelta: content, done: false };
      yield { contentDelta: "", done: true };
    }
  };
}
