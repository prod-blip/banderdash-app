export const INTERACTION_PATTERNS = ["ReactiveValue", "CompareToggle"] as const;
export type InteractionPattern = (typeof INTERACTION_PATTERNS)[number];

export const INTERACTION_CANDIDATE_STATUSES = ["proposed", "rejected_by_critic", "survived"] as const;
export type InteractionCandidateStatus = (typeof INTERACTION_CANDIDATE_STATUSES)[number];

export interface InteractionCandidate {
  id: string;
  articleId: string;
  documentVersion: number;
  blockIds: string[];
  spanIds: string[];
  pattern: InteractionPattern;
  rationale: string;
  requiredData: string[];
  libraryRepresentable: boolean;
  understandingLossIfRemoved: string;
  status: InteractionCandidateStatus;
}

export const interactionCandidateJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "articleId",
          "documentVersion",
          "blockIds",
          "spanIds",
          "pattern",
          "rationale",
          "requiredData",
          "libraryRepresentable",
          "understandingLossIfRemoved",
          "status"
        ],
        properties: {
          id: { type: "string", minLength: 1 },
          articleId: { type: "string", minLength: 1 },
          documentVersion: { type: "integer", minimum: 1 },
          blockIds: { type: "array", minItems: 1, items: { type: "string", minLength: 1 } },
          spanIds: { type: "array", items: { type: "string", minLength: 1 } },
          pattern: { type: "string", enum: [...INTERACTION_PATTERNS] },
          rationale: { type: "string", minLength: 1 },
          requiredData: { type: "array", items: { type: "string" } },
          libraryRepresentable: { type: "boolean" },
          understandingLossIfRemoved: { type: "string", minLength: 1 },
          status: { type: "string", enum: [...INTERACTION_CANDIDATE_STATUSES] }
        }
      }
    }
  }
} as const;

export interface InteractionCandidateSet {
  candidates: InteractionCandidate[];
}

export function isInteractionCandidate(value: unknown): value is InteractionCandidate {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.articleId) &&
    isPositiveInteger(value.documentVersion) &&
    isNonEmptyStringArray(value.blockIds) &&
    isStringArray(value.spanIds) &&
    isInteractionPattern(value.pattern) &&
    isNonEmptyString(value.rationale) &&
    isStringArray(value.requiredData) &&
    typeof value.libraryRepresentable === "boolean" &&
    isNonEmptyString(value.understandingLossIfRemoved) &&
    isInteractionCandidateStatus(value.status)
  );
}

export function isInteractionCandidateSet(value: unknown): value is InteractionCandidateSet {
  if (!isRecord(value) || !Array.isArray(value.candidates)) {
    return false;
  }

  return value.candidates.every(isInteractionCandidate);
}

export function isInteractionPattern(value: unknown): value is InteractionPattern {
  return typeof value === "string" && INTERACTION_PATTERNS.includes(value as InteractionPattern);
}

export function isInteractionCandidateStatus(value: unknown): value is InteractionCandidateStatus {
  return typeof value === "string" && INTERACTION_CANDIDATE_STATUSES.includes(value as InteractionCandidateStatus);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}
