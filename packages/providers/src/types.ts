export type ProviderMessageRole = "system" | "user" | "assistant";

export interface Msg {
  role: ProviderMessageRole;
  content: string;
}

export interface Schema {
  name: string;
  description?: string;
  jsonSchema: Record<string, unknown>;
}

export interface CallOpts {
  model: string;
  messages: Msg[];
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface StructuredCallOpts<T = unknown> extends CallOpts {
  schema: Schema;
  validate?: (value: unknown) => value is T;
}

export interface Result {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface StructuredResult<T = unknown> extends Result {
  value: T;
}

export interface Chunk {
  contentDelta: string;
  done: boolean;
}

export interface ProviderCapabilities {
  models: string[];
  supportsStructuredOutput: boolean;
  supportsStreaming: boolean;
  contextWindowTokens: number;
}

export interface ProviderHealth {
  ok: boolean;
  message: string;
}

export interface LLMProvider {
  name: string;
  capabilities(): Promise<ProviderCapabilities>;
  checkAuth(): Promise<ProviderHealth>;
  complete(options: CallOpts): Promise<Result>;
  structured<T = unknown>(options: StructuredCallOpts<T>): Promise<StructuredResult<T>>;
  stream?(options: CallOpts): AsyncIterable<Chunk>;
}
