import type { ArticleDoc } from "@banderdash/doc-model";
import type { InteractionCandidate, InteractionCandidateStatus } from "../schemas/candidate.js";

export type CriticEvalExpectedDecision = Extract<InteractionCandidateStatus, "survived" | "rejected_by_critic">;

export interface CriticEvalFixture {
  article: ArticleDoc;
  candidate: InteractionCandidate;
  expected: {
    status: CriticEvalExpectedDecision;
    reason: string;
  };
  id: string;
  name: string;
}

const createdAt = "2026-06-15T00:00:00.000Z";

export const criticEvalFixtures: CriticEvalFixture[] = [
  createFixture({
    id: "meaningful_quantity_interaction",
    name: "Meaningful quantity interaction survives",
    articleText: "A 10% price increase can produce a 25% profit increase because fixed costs stay flat.",
    pattern: "ReactiveValue",
    rationale: "A slider lets readers test how price changes amplify profit when fixed costs stay flat.",
    understandingLossIfRemoved: "Readers lose the ability to see why a small price move produces a larger profit move under fixed costs.",
    expectedStatus: "survived",
    expectedReason: "The interaction enacts the numeric relationship in the claim; removing it costs understanding of the leverage effect."
  }),
  createFixture({
    id: "decorative_animation",
    name: "Decorative animation is rejected",
    articleText: "The market finally woke up after months of silence.",
    pattern: "ReactiveValue",
    rationale: "Animate the sentence so it wakes up on scroll.",
    understandingLossIfRemoved: "The article would be less visually lively.",
    expectedStatus: "rejected_by_critic",
    expectedReason: "The animation decorates a metaphor; removing it does not reduce comprehension of the claim."
  }),
  createFixture({
    id: "useful_comparison",
    name: "Useful comparison survives",
    articleText: "Old onboarding took five separate screens, while the new flow groups the same decisions into two focused steps.",
    pattern: "compare_toggle",
    rationale: "A compare toggle shows old versus new onboarding structure so readers can inspect what changed.",
    understandingLossIfRemoved: "Readers lose the direct side-by-side contrast that explains why the new flow feels simpler.",
    expectedStatus: "survived",
    expectedReason: "The comparison is central to the claim and the interaction helps readers inspect the structural change."
  }),
  createFixture({
    id: "shallow_comparison",
    name: "Shallow comparison is rejected",
    articleText: "The old logo was blue, and the new logo is green.",
    pattern: "compare_toggle",
    rationale: "Toggle between old and new colors.",
    understandingLossIfRemoved: "Readers may not see the brand vibe shift as clearly.",
    expectedStatus: "rejected_by_critic",
    expectedReason: "The comparison is cosmetic and easily understood from prose; interaction adds visual interest, not meaning."
  }),
  createFixture({
    id: "jargon_explanation",
    name: "Jargon explanation is rejected until it has an enacted relationship",
    articleText: "The team reduced p95 latency by introducing backpressure in the queue.",
    pattern: "ReactiveValue",
    rationale: "Add an expandable glossary card for p95 latency and backpressure.",
    understandingLossIfRemoved: "Readers who do not know the jargon may need definitions.",
    expectedStatus: "rejected_by_critic",
    expectedReason: "Definitions may be useful editorial support, but this candidate does not enact a relationship that requires interaction."
  }),
  createFixture({
    id: "thematic_vague_suggestion",
    name: "Thematic vague suggestion is rejected",
    articleText: "Trust compounds slowly, then collapses all at once after repeated misses.",
    pattern: "ReactiveValue",
    rationale: "Create an interactive trust meter to make the theme feel tangible.",
    understandingLossIfRemoved: "The piece may feel less immersive.",
    expectedStatus: "rejected_by_critic",
    expectedReason: "The proposed meter is thematic but underspecified; removing it does not cost understanding of the sentence."
  })
];

function createFixture(input: {
  articleText: string;
  expectedReason: string;
  expectedStatus: CriticEvalExpectedDecision;
  id: string;
  name: string;
  pattern: InteractionCandidate["pattern"];
  rationale: string;
  understandingLossIfRemoved: string;
}): CriticEvalFixture {
  const articleId = `article_${input.id}`;
  const blockId = `block_${input.id}`;
  const candidateId = `candidate_${input.id}`;

  const article: ArticleDoc = {
    id: articleId,
    version: 1,
    blocks: [
      {
        id: blockId,
        version: 1,
        type: "paragraph",
        text: input.articleText,
        spans: [],
        signals: []
      }
    ],
    meta: {
      createdAt,
      updatedAt: createdAt,
      wordCount: input.articleText.trim().split(/\s+/u).length
    }
  };

  return {
    article,
    candidate: {
      id: candidateId,
      articleId,
      documentVersion: article.version,
      blockIds: [blockId],
      spanIds: [],
      pattern: input.pattern,
      rationale: input.rationale,
      requiredData: [],
      libraryRepresentable: true,
      understandingLossIfRemoved: input.understandingLossIfRemoved,
      status: "proposed"
    },
    expected: {
      status: input.expectedStatus,
      reason: input.expectedReason
    },
    id: input.id,
    name: input.name
  };
}
