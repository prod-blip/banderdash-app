import type { ArticleDoc } from "@banderdash/doc-model";
import type { LLMProvider, Schema } from "@banderdash/providers";
import type { BanderdashDatabase } from "../services/db.js";
import {
  interactionCandidateJsonSchema,
  isInteractionCandidateSet,
  type InteractionCandidate,
  type InteractionCandidateSet
} from "./schemas/candidate.js";

export interface CriticNodeOptions {
  article: ArticleDoc;
  candidates: InteractionCandidate[];
  db: BanderdashDatabase;
  model: string;
  provider: LLMProvider;
  now?: () => Date;
}

const criticStructuredSchema: Schema = {
  name: "critic_candidate_decisions",
  description: "Critic decisions for proposed interactions using the enact-meaning-not-decoration rule.",
  jsonSchema: interactionCandidateJsonSchema
};

export class CriticProviderCapabilityError extends Error {
  constructor(providerName: string) {
    super(`Provider ${providerName} must support structured output for the Critic node.`);
    this.name = "CriticProviderCapabilityError";
  }
}

export class CriticCandidateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CriticCandidateValidationError";
  }
}

export async function runCriticNode(options: CriticNodeOptions): Promise<InteractionCandidate[]> {
  const capabilities = await options.provider.capabilities();
  if (!capabilities.supportsStructuredOutput) {
    throw new CriticProviderCapabilityError(options.provider.name);
  }

  const proposedCandidates = options.candidates.filter((candidate) => candidate.status === "proposed");
  if (proposedCandidates.length === 0) {
    return [];
  }

  const result = await options.provider.structured<InteractionCandidateSet>({
    model: options.model,
    messages: buildCriticMessages(options.article, proposedCandidates),
    schema: criticStructuredSchema,
    temperature: 0.1,
    validate: isInteractionCandidateSet
  });

  const reviewedCandidates = validateCriticDecisions(result.value.candidates, proposedCandidates, options.article);
  persistCriticDecisions(options.db, reviewedCandidates, options.now?.() ?? new Date());
  return reviewedCandidates;
}

export function buildCriticMessages(
  article: ArticleDoc,
  candidates: InteractionCandidate[]
): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content: [
        "You are Banderdash Critic.",
        "Prune interaction candidates ruthlessly using the core rule: an interaction must enact meaning, not decorate it.",
        "Return each input candidate exactly once with status survived or rejected_by_critic.",
        "Use survived only when the interaction makes a concrete article claim, quantity, comparison, relationship, or sequence easier to understand.",
        "Reject decorative animation, visual polish, shallow comparisons, glossary-only jargon explanations, vague thematic suggestions, and cases where prose already carries the meaning.",
        "Reject candidates that lack a concrete, article-specific answer to what understanding would be lost if removed.",
        "Prefer library-representable patterns when they are sufficient; do not reward bespoke novelty.",
        "Do not invent candidate IDs, article IDs, document versions, block IDs, span IDs, or pattern values."
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
        })),
        candidates
      })
    }
  ];
}

function validateCriticDecisions(
  reviewedCandidates: InteractionCandidate[],
  proposedCandidates: InteractionCandidate[],
  article: ArticleDoc
): InteractionCandidate[] {
  const proposedById = new Map(proposedCandidates.map((candidate) => [candidate.id, candidate]));
  const reviewedIds = new Set<string>();

  if (reviewedCandidates.length !== proposedCandidates.length) {
    throw new CriticCandidateValidationError("Critic must return exactly one decision for each proposed candidate.");
  }

  for (const candidate of reviewedCandidates) {
    const proposed = proposedById.get(candidate.id);
    if (!proposed) {
      throw new CriticCandidateValidationError(`Critic returned unknown candidate ${candidate.id}.`);
    }

    if (reviewedIds.has(candidate.id)) {
      throw new CriticCandidateValidationError(`Critic returned duplicate candidate ${candidate.id}.`);
    }
    reviewedIds.add(candidate.id);

    if (candidate.articleId !== article.id || candidate.articleId !== proposed.articleId) {
      throw new CriticCandidateValidationError(`Candidate ${candidate.id} does not match article ${article.id}.`);
    }

    if (candidate.documentVersion !== article.version || candidate.documentVersion !== proposed.documentVersion) {
      throw new CriticCandidateValidationError(`Candidate ${candidate.id} does not match document version ${article.version}.`);
    }

    if (candidate.status === "proposed") {
      throw new CriticCandidateValidationError(`Critic must decide candidate ${candidate.id}; proposed is not a final critic status.`);
    }

    if (!sameStringArray(candidate.blockIds, proposed.blockIds)) {
      throw new CriticCandidateValidationError(`Critic changed block references for candidate ${candidate.id}.`);
    }

    if (!sameStringArray(candidate.spanIds, proposed.spanIds)) {
      throw new CriticCandidateValidationError(`Critic changed span references for candidate ${candidate.id}.`);
    }

    if (candidate.pattern !== proposed.pattern) {
      throw new CriticCandidateValidationError(`Critic changed pattern for candidate ${candidate.id}.`);
    }
  }

  return reviewedCandidates;
}

function persistCriticDecisions(db: BanderdashDatabase, candidates: InteractionCandidate[], now: Date): void {
  const timestamp = now.toISOString();
  const statement = db.prepare("update candidates set status = ?, payload_json = ?, updated_at = ? where id = ?");

  db.exec("BEGIN;");
  try {
    for (const candidate of candidates) {
      const result = statement.run(candidate.status, JSON.stringify(candidate), timestamp, candidate.id);
      if (result.changes !== 1) {
        throw new CriticCandidateValidationError(`Candidate ${candidate.id} could not be updated.`);
      }
    }
    db.exec("COMMIT;");
  } catch (error) {
    db.exec("ROLLBACK;");
    throw error;
  }
}

function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
