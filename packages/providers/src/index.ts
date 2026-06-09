export { createOpenAICompatibleProvider, createOpenAICompatibleProviderFromEnv } from "./adapters/openai-compatible.js";
export type { OpenAICompatibleProviderOptions } from "./adapters/openai-compatible.js";
export { createFakeProvider } from "./fake.js";
export type { FakeProviderOptions } from "./fake.js";
export { runProviderPreflight } from "./preflight.js";
export type {
  ProviderPreflightCheck,
  ProviderPreflightReport,
  ProviderPreflightRequirement,
  PreflightStatus
} from "./preflight.js";
export type {
  CallOpts,
  Chunk,
  LLMProvider,
  Msg,
  ProviderCapabilities,
  ProviderHealth,
  Result,
  Schema,
  StructuredCallOpts,
  StructuredResult
} from "./types.js";
