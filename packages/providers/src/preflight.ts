import type { LLMProvider } from "./types.js";

export type PreflightStatus = "pass" | "warn" | "fail";

export interface ProviderPreflightRequirement {
  model: string;
  requiresStructuredOutput?: boolean;
  requiresStreaming?: boolean;
  minContextWindowTokens?: number;
}

export interface ProviderPreflightCheck {
  id: string;
  label: string;
  status: PreflightStatus;
  message: string;
}

export interface ProviderPreflightReport {
  providerName: string;
  checks: ProviderPreflightCheck[];
  ok: boolean;
}

export async function runProviderPreflight(
  provider: LLMProvider,
  requirement: ProviderPreflightRequirement
): Promise<ProviderPreflightReport> {
  const checks: ProviderPreflightCheck[] = [];
  const auth = await provider.checkAuth();
  checks.push({
    id: "provider-auth",
    label: "Provider auth",
    status: auth.ok ? "pass" : "fail",
    message: auth.message
  });

  const capabilities = await provider.capabilities();
  checks.push({
    id: "provider-model",
    label: "Provider model",
    status: capabilities.models.includes(requirement.model) ? "pass" : "fail",
    message: capabilities.models.includes(requirement.model)
      ? `model ${requirement.model} is available`
      : `model ${requirement.model} is not in provider capabilities`
  });

  if (requirement.requiresStructuredOutput ?? true) {
    checks.push({
      id: "provider-structured-output",
      label: "Structured output",
      status: capabilities.supportsStructuredOutput ? "pass" : "fail",
      message: capabilities.supportsStructuredOutput
        ? "provider supports structured output"
        : "provider must support structured output for workflow nodes"
    });
  }

  if (requirement.requiresStreaming) {
    checks.push({
      id: "provider-streaming",
      label: "Streaming",
      status: capabilities.supportsStreaming ? "pass" : "fail",
      message: capabilities.supportsStreaming ? "provider supports streaming" : "configured workflow requires streaming"
    });
  }

  if (requirement.minContextWindowTokens !== undefined) {
    checks.push({
      id: "provider-context-window",
      label: "Context window",
      status: capabilities.contextWindowTokens >= requirement.minContextWindowTokens ? "pass" : "fail",
      message:
        capabilities.contextWindowTokens >= requirement.minContextWindowTokens
          ? `context window ${capabilities.contextWindowTokens} tokens meets requirement`
          : `context window ${capabilities.contextWindowTokens} tokens is below required ${requirement.minContextWindowTokens}`
    });
  }

  return {
    providerName: provider.name,
    checks,
    ok: checks.every((check) => check.status !== "fail")
  };
}
