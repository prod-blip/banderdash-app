import type {
  CallOpts,
  Chunk,
  LLMProvider,
  ProviderCapabilities,
  ProviderHealth,
  Result,
  StructuredCallOpts,
  StructuredResult
} from "../types.js";

export interface OpenAICompatibleProviderOptions {
  apiKey: string | undefined;
  baseUrl?: string;
  fetch?: typeof fetch;
}

interface ChatCompletionResponse {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}

interface ModelsResponse {
  data?: Array<{
    id?: string;
  }>;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_CONTEXT_WINDOW_TOKENS = 8_000;

export function createOpenAICompatibleProvider(options: OpenAICompatibleProviderOptions): LLMProvider {
  const client = new OpenAICompatibleClient(options);

  return {
    name: "openai-compatible",
    capabilities: () => client.capabilities(),
    checkAuth: () => client.checkAuth(),
    complete: (callOptions) => client.complete(callOptions),
    structured: (callOptions) => client.structured(callOptions),
    stream: (callOptions) => client.stream(callOptions)
  };
}

export function createOpenAICompatibleProviderFromEnv(env: NodeJS.ProcessEnv = process.env): LLMProvider {
  return createOpenAICompatibleProvider({
    apiKey: env.OPENAI_COMPATIBLE_API_KEY ?? env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_COMPATIBLE_BASE_URL ?? env.OPENAI_BASE_URL
  });
}

class OpenAICompatibleClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private cachedModels: string[] | null = null;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.fetchImpl = options.fetch ?? fetch;
  }

  async checkAuth(): Promise<ProviderHealth> {
    if (!this.apiKey) {
      return {
        ok: false,
        message: "OPENAI_COMPATIBLE_API_KEY or OPENAI_API_KEY must be set for openai-compatible provider"
      };
    }

    try {
      const models = await this.fetchModels();
      return {
        ok: true,
        message: `provider reachable; ${models.length} model(s) available`
      };
    } catch (error) {
      return {
        ok: false,
        message: formatProviderError(error)
      };
    }
  }

  async capabilities(): Promise<ProviderCapabilities> {
    const models = this.apiKey ? await this.fetchModels().catch(() => []) : [];
    return {
      models,
      supportsStructuredOutput: true,
      supportsStreaming: true,
      contextWindowTokens: DEFAULT_CONTEXT_WINDOW_TOKENS
    };
  }

  async complete(options: CallOpts): Promise<Result> {
    const response = await this.postChatCompletion({
      model: options.model,
      messages: options.messages,
      max_tokens: options.maxOutputTokens,
      temperature: options.temperature
    }, options.signal);

    return mapChatCompletionResponse(response, options.model);
  }

  async structured<T = unknown>(options: StructuredCallOpts<T>): Promise<StructuredResult<T>> {
    const response = await this.postChatCompletion(
      {
        model: options.model,
        messages: options.messages,
        max_tokens: options.maxOutputTokens,
        temperature: options.temperature,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: options.schema.name,
            description: options.schema.description,
            schema: options.schema.jsonSchema,
            strict: true
          }
        }
      },
      options.signal
    );

    const result = mapChatCompletionResponse(response, options.model);
    const parsed = parseStructuredContent(result.content, options.schema.name);

    if (options.validate && !options.validate(parsed)) {
      throw new Error(`OpenAI-compatible structured response failed schema validation: ${options.schema.name}`);
    }

    return {
      ...result,
      value: parsed as T
    };
  }

  async *stream(options: CallOpts): AsyncIterable<Chunk> {
    const response = await this.request("/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        max_tokens: options.maxOutputTokens,
        temperature: options.temperature,
        stream: true
      }),
      signal: options.signal
    });

    const body = await response.text();
    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }

      const data = trimmed.slice("data:".length).trim();
      if (data === "[DONE]") {
        yield { contentDelta: "", done: true };
        return;
      }

      const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
      const contentDelta = parsed.choices?.[0]?.delta?.content;
      if (contentDelta) {
        yield { contentDelta, done: false };
      }
    }

    yield { contentDelta: "", done: true };
  }

  private async fetchModels(): Promise<string[]> {
    if (this.cachedModels) {
      return this.cachedModels;
    }

    const response = await this.request("/models", { method: "GET" });
    const json = (await response.json()) as ModelsResponse;
    const models = (json.data ?? [])
      .map((model) => model.id)
      .filter((model): model is string => typeof model === "string" && model.length > 0);
    this.cachedModels = models;
    return models;
  }

  private async postChatCompletion(body: Record<string, unknown>, signal: AbortSignal | undefined): Promise<ChatCompletionResponse> {
    const response = await this.request("/chat/completions", {
      method: "POST",
      body: JSON.stringify(body),
      signal
    });
    return (await response.json()) as ChatCompletionResponse;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    if (!this.apiKey) {
      throw new Error("missing OpenAI-compatible API key");
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...init.headers
      }
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`provider request failed (${response.status}): ${body || response.statusText}`);
    }

    return response;
  }
}

function mapChatCompletionResponse(response: ChatCompletionResponse, fallbackModel: string): Result {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new Error("provider response did not include message content");
  }

  return {
    content,
    model: response.model ?? fallbackModel,
    usage:
      typeof response.usage?.prompt_tokens === "number" && typeof response.usage.completion_tokens === "number"
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens
          }
        : undefined
  };
}

function parseStructuredContent(content: string, schemaName: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(`OpenAI-compatible structured response for ${schemaName} was not valid JSON: ${formatProviderError(error)}`);
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function formatProviderError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
