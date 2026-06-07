export const BLOCK_TYPES = ["paragraph", "heading", "list", "quote"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const SIGNAL_KINDS = [
  "quantity",
  "comparison",
  "sequence",
  "dataset",
  "causal",
  "geographic",
  "jargon",
  "thematic"
] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export interface ArticleDoc {
  id: string;
  version: number;
  blocks: Block[];
  meta: ArticleMeta;
}

export interface ArticleMeta {
  title?: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
}

export interface Block {
  id: string;
  version: number;
  type: BlockType;
  text: string;
  spans: Span[];
  signals: Signal[];
}

export interface Span {
  id: string;
  text: string;
  start: number;
  end: number;
}

export interface Signal {
  spanId: string;
  kind: SignalKind;
  confidence: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && BLOCK_TYPES.includes(value as BlockType);
}

export function isSignalKind(value: unknown): value is SignalKind {
  return typeof value === "string" && SIGNAL_KINDS.includes(value as SignalKind);
}

export function isSpan(value: unknown): value is Span {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    typeof value.text === "string" &&
    isNonNegativeInteger(value.start) &&
    isNonNegativeInteger(value.end) &&
    value.end >= value.start
  );
}

export function isSignal(value: unknown): value is Signal {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.spanId) &&
    isSignalKind(value.kind) &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 1
  );
}

export function isBlock(value: unknown): value is Block {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isPositiveInteger(value.version) &&
    isBlockType(value.type) &&
    typeof value.text === "string" &&
    Array.isArray(value.spans) &&
    value.spans.every(isSpan) &&
    Array.isArray(value.signals) &&
    value.signals.every(isSignal)
  );
}

export function isArticleMeta(value: unknown): value is ArticleMeta {
  if (!isRecord(value)) {
    return false;
  }

  return (
    (value.title === undefined || typeof value.title === "string") &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt) &&
    isNonNegativeInteger(value.wordCount)
  );
}

export function isArticleDoc(value: unknown): value is ArticleDoc {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isPositiveInteger(value.version) &&
    Array.isArray(value.blocks) &&
    value.blocks.every(isBlock) &&
    isArticleMeta(value.meta)
  );
}
