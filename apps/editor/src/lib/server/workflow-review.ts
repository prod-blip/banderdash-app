import { randomUUID } from "node:crypto";
import type { ArticleDoc, Block } from "@banderdash/doc-model";
import { runAnalystNode } from "@banderdash/backend/nodes/analyst";
import { runCriticNode } from "@banderdash/backend/nodes/critic";
import type { InteractionCandidate } from "@banderdash/backend/nodes/schemas/candidate";
import { createCandidateConsentService, type CandidateConsentDecision } from "@banderdash/backend/services/candidateConsent";
import { createFakeProvider } from "@banderdash/providers";
import { getEditorArticleService, getEditorDatabase } from "./article-service";

export interface CandidateReviewResult {
  articleId: string;
  documentVersion: number;
  candidates: InteractionCandidate[];
  mode: "local-fake-provider";
}

export interface CandidateConsentResult {
  id: string;
  candidateId: string;
  articleId: string;
  documentVersion: number;
  decision: CandidateConsentDecision;
  createdAt: string;
}

export async function runLocalCandidateReview(articleId: string, expectedVersion: number): Promise<CandidateReviewResult> {
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw new Error("expectedVersion must be a positive integer.");
  }

  const article = await getEditorArticleService().getArticle(articleId);
  if (article.version !== expectedVersion) {
    throw new Error(`Article ${article.id} is at version ${article.version}; reload before analyzing version ${expectedVersion}.`);
  }

  const analystCandidate = createLocalAnalystCandidate(article);
  const analystProvider = createFakeProvider({ structuredValue: { candidates: analystCandidate ? [analystCandidate] : [] } });
  const db = getEditorDatabase();
  const proposedCandidates = await runAnalystNode({ article, db, model: "local-fake-workflow", provider: analystProvider });

  const criticProvider = createFakeProvider({
    structuredValue: {
      candidates: proposedCandidates.map((candidate) => ({ ...candidate, status: "survived" }))
    }
  });
  const reviewedCandidates = await runCriticNode({ article, candidates: proposedCandidates, db, model: "local-fake-workflow", provider: criticProvider });

  return {
    articleId: article.id,
    candidates: reviewedCandidates,
    documentVersion: article.version,
    mode: "local-fake-provider"
  };
}

export async function recordCandidateConsent(options: {
  articleId: string;
  candidateId: string;
  decision: CandidateConsentDecision;
  expectedVersion: number;
}): Promise<CandidateConsentResult> {
  const consentService = createCandidateConsentService({ db: getEditorDatabase() });
  return consentService.recordConsent(options);
}

function createLocalAnalystCandidate(article: ArticleDoc): InteractionCandidate | null {
  const comparisonBlock = article.blocks.find(hasComparisonText);
  if (comparisonBlock) {
    return {
      id: `candidate_${randomUUID()}`,
      articleId: article.id,
      documentVersion: article.version,
      blockIds: [comparisonBlock.id],
      spanIds: [],
      pattern: "compare_toggle",
      rationale: "This block compares two alternatives that readers can understand by toggling between them.",
      requiredData: ["two compared options from source block"],
      libraryRepresentable: true,
      understandingLossIfRemoved:
        "Readers lose the ability to focus on each side of the comparison and see how the alternatives differ in context.",
      status: "proposed"
    };
  }

  const numericBlock = article.blocks.find(hasNumericText) ?? article.blocks[0];
  if (!numericBlock || !hasNumericText(numericBlock)) {
    return null;
  }

  return {
    id: `candidate_${randomUUID()}`,
    articleId: article.id,
    documentVersion: article.version,
    blockIds: [numericBlock.id],
    spanIds: [],
    pattern: "ReactiveValue",
    rationale: "This block contains a numeric relationship that readers can test by adjusting a value.",
    requiredData: ["numeric value from source block"],
    libraryRepresentable: true,
    understandingLossIfRemoved:
      "Readers lose the ability to explore how the numeric relationship changes the article claim instead of only reading the fixed value.",
    status: "proposed"
  };
}

export function hasComparisonText(block: Block): boolean {
  return /\b(versus|vs\.?|compared with|compared to|rather than|while|whereas)\b/iu.test(block.text);
}

function hasNumericText(block: Block): boolean {
  return /\d/u.test(block.text);
}
