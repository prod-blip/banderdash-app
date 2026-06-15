import type { ArticleDoc } from "@banderdash/doc-model";
import type { LLMProvider, Schema } from "@banderdash/providers";
import type { BanderdashDatabase } from "../services/db.js";
import {
  interactionCandidateJsonSchema,
  isInteractionCandidateSet,
  type InteractionCandidate,
  type InteractionCandidateSet
} from "./schemas/candidate.js";

export interface AnalystNodeOptions {
  article: ArticleDoc;
  db: BanderdashDatabase;
  model: string;
  provider: LLMProvider;
  now?: () => Date;
}

const analystStructuredSchema: Schema = {
  name: "interaction_candidates",
  description: "Candidate interactions that enact article meaning and are tied to source block/span IDs.",
  jsonSchema: interactionCandidateJsonSchema
};

export class AnalystProviderCapabilityError extends Error {
  constructor(providerName: string) {
    super(`Provider ${providerName} must support structured output for the Analyst node.`);
    this.name = "AnalystProviderCapabilityError";
  }
}

export class AnalystCandidateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalystCandidateValidationError";
  }
}

export async function runAnalystNode(options: AnalystNodeOptions): Promise<InteractionCandidate[]> {
  const capabilities = await options.provider.capabilities();
  if (!capabilities.supportsStructuredOutput) {
    throw new AnalystProviderCapabilityError(options.provider.name);
  }

  const result = await options.provider.structured<InteractionCandidateSet>({
    model: options.model,
    messages: buildAnalystMessages(options.article),
    schema: analystStructuredSchema,
    temperature: 0.2,
    validate: isInteractionCandidateSet
  });

  const candidates = validateCandidatesForArticle(result.value.candidates, options.article);
  persistCandidates(options.db, candidates, options.now?.() ?? new Date());
  return candidates;
}

export function buildAnalystMessages(article: ArticleDoc): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content: [
        "You are Banderdash Analyst.",
        "Propose only interactions that enact meaning, not decoration; if prose alone already carries the meaning, return no candidate for that block.",
        "Reject decorative animation, visual polish, glossary-only jargon explanations, shallow comparisons, and vague thematic meters before they become candidates.",
        "Every candidate must reference existing block IDs and answer what specific understanding would be lost if removed.",
        "Prefer audited library patterns when sufficient: ReactiveValue for numeric relationships or compare_toggle for comparison language such as X versus Y."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify({
        articleId: article.id,
        documentVersion: article.version,
        blocks: article.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          text: block.text,
          spans: block.spans,
          signals: block.signals
        }))
      })
    }
  ];
}

function validateCandidatesForArticle(candidates: InteractionCandidate[], article: ArticleDoc): InteractionCandidate[] {
  const blockIds = new Set(article.blocks.map((block) => block.id));
  const spanIds = new Set(article.blocks.flatMap((block) => block.spans.map((span) => span.id)));

  for (const candidate of candidates) {
    if (candidate.articleId !== article.id) {
      throw new AnalystCandidateValidationError(`Candidate ${candidate.id} does not match article ${article.id}.`);
    }

    if (candidate.documentVersion !== article.version) {
      throw new AnalystCandidateValidationError(`Candidate ${candidate.id} does not match document version ${article.version}.`);
    }

    const missingBlockId = candidate.blockIds.find((blockId) => !blockIds.has(blockId));
    if (missingBlockId) {
      throw new AnalystCandidateValidationError(`Candidate ${candidate.id} references unknown block ${missingBlockId}.`);
    }

    const missingSpanId = candidate.spanIds.find((spanId) => !spanIds.has(spanId));
    if (missingSpanId) {
      throw new AnalystCandidateValidationError(`Candidate ${candidate.id} references unknown span ${missingSpanId}.`);
    }
  }

  return candidates;
}

function persistCandidates(db: BanderdashDatabase, candidates: InteractionCandidate[], now: Date): void {
  const timestamp = now.toISOString();
  const statement = db.prepare(
    `insert into candidates (id, article_id, document_version, block_id, status, payload_json, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  db.exec("BEGIN;");
  try {
    for (const candidate of candidates) {
      statement.run(
        candidate.id,
        candidate.articleId,
        candidate.documentVersion,
        candidate.blockIds[0] ?? null,
        candidate.status,
        JSON.stringify(candidate),
        timestamp,
        timestamp
      );
    }
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}
