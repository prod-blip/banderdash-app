import { randomUUID } from "node:crypto";
import type { ArticleDoc } from "@banderdash/doc-model";
import type { LLMProvider, Schema } from "@banderdash/providers";
import type { BanderdashDatabase } from "../services/db.js";
import type { InteractionCandidate } from "./schemas/candidate.js";
import {
  componentSpecJsonSchema,
  isComponentSpecSet,
  validateLibraryComponentSpec,
  type ComponentSpec,
  type ComponentSpecSet
} from "./schemas/componentSpec.js";

export interface SpecAgentNodeOptions {
  article: ArticleDoc;
  candidates: InteractionCandidate[];
  db: BanderdashDatabase;
  model: string;
  provider: LLMProvider;
  now?: () => Date;
}

const specAgentStructuredSchema: Schema = {
  name: "component_specs",
  description: "Concrete library component specs for writer-approved interaction candidates.",
  jsonSchema: componentSpecJsonSchema
};

export class SpecAgentProviderCapabilityError extends Error {
  constructor(providerName: string) {
    super(`Provider ${providerName} must support structured output for the Spec Agent node.`);
    this.name = "SpecAgentProviderCapabilityError";
  }
}

export class SpecAgentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpecAgentValidationError";
  }
}

export async function runSpecAgentNode(options: SpecAgentNodeOptions): Promise<ComponentSpec[]> {
  const capabilities = await options.provider.capabilities();
  if (!capabilities.supportsStructuredOutput) {
    throw new SpecAgentProviderCapabilityError(options.provider.name);
  }

  const approvedCandidates = getApprovedCandidates(options.db, options.candidates, options.article);
  if (approvedCandidates.length === 0) {
    return [];
  }

  const result = await options.provider.structured<ComponentSpecSet>({
    model: options.model,
    messages: buildSpecAgentMessages(options.article, approvedCandidates),
    schema: specAgentStructuredSchema,
    temperature: 0.1,
    validate: isComponentSpecSet
  });

  const specs = validateSpecsForApprovedCandidates(result.value.specs, approvedCandidates, options.article);
  persistGeneratedSpecs(options.db, specs, options.now?.() ?? new Date());
  return specs;
}

export function buildSpecAgentMessages(
  article: ArticleDoc,
  candidates: InteractionCandidate[]
): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content: [
        "You are Banderdash Spec Agent.",
        "Convert writer-approved interaction candidates into concrete audited library component specs.",
        "Use only componentName ReactiveValue for the current MVP path.",
        "Every spec must include validated props, embedded source data, fallback text, accessibility notes, and reduced-motion requirements.",
        "Do not invent candidate IDs, article IDs, document versions, block IDs, or unsupported component names."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify({
        articleId: article.id,
        documentVersion: article.version,
        blocks: article.blocks.map((block) => ({ id: block.id, type: block.type, text: block.text, spans: block.spans, signals: block.signals })),
        approvedCandidates: candidates
      })
    }
  ];
}

function getApprovedCandidates(
  db: BanderdashDatabase,
  candidates: InteractionCandidate[],
  article: ArticleDoc
): InteractionCandidate[] {
  const statement = db.prepare(
    "select id from approvals where candidate_id = ? and article_id = ? and document_version = ? and decision = 'approved' and invalidated_at is null"
  );

  return candidates.filter((candidate) => {
    if (candidate.articleId !== article.id || candidate.documentVersion !== article.version || candidate.status !== "survived") {
      return false;
    }

    return Boolean(statement.get(candidate.id, article.id, article.version));
  });
}

function validateSpecsForApprovedCandidates(
  specs: ComponentSpec[],
  approvedCandidates: InteractionCandidate[],
  article: ArticleDoc
): ComponentSpec[] {
  const approvedById = new Map(approvedCandidates.map((candidate) => [candidate.id, candidate]));
  const specCandidateIds = new Set<string>();

  if (specs.length !== approvedCandidates.length) {
    throw new SpecAgentValidationError("Spec Agent must return exactly one spec for each approved candidate.");
  }

  for (const spec of specs) {
    const candidate = approvedById.get(spec.candidateId);
    if (!candidate) {
      throw new SpecAgentValidationError(`Spec ${spec.id} references unapproved candidate ${spec.candidateId}.`);
    }
    if (specCandidateIds.has(spec.candidateId)) {
      throw new SpecAgentValidationError(`Spec Agent returned duplicate spec for candidate ${spec.candidateId}.`);
    }
    specCandidateIds.add(spec.candidateId);

    if (spec.articleId !== article.id || spec.articleId !== candidate.articleId) {
      throw new SpecAgentValidationError(`Spec ${spec.id} does not match article ${article.id}.`);
    }
    if (spec.documentVersion !== article.version || spec.documentVersion !== candidate.documentVersion) {
      throw new SpecAgentValidationError(`Spec ${spec.id} does not match document version ${article.version}.`);
    }
    if (candidate.pattern !== "ReactiveValue" || spec.componentName !== "ReactiveValue") {
      throw new SpecAgentValidationError(`Spec ${spec.id} must use the audited ReactiveValue component path.`);
    }
    if (!validateLibraryComponentSpec(spec)) {
      throw new SpecAgentValidationError(`Spec ${spec.id} has invalid props for ${spec.componentName}.`);
    }
  }

  return specs;
}

function persistGeneratedSpecs(db: BanderdashDatabase, specs: ComponentSpec[], now: Date): void {
  const timestamp = now.toISOString();
  const statement = db.prepare(
    `insert into generated_specs (id, candidate_id, article_id, document_version, payload_json, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?)`
  );

  db.exec("BEGIN;");
  try {
    for (const spec of specs) {
      statement.run(spec.id || `spec_${randomUUID()}`, spec.candidateId, spec.articleId, spec.documentVersion, JSON.stringify(spec), timestamp, timestamp);
    }
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}
