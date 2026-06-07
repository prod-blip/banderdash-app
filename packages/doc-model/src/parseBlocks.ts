import { createHash } from "node:crypto";
import type { Block, BlockType } from "./types.js";
import { assertWithinWordLimit } from "./wordCount.js";

export interface ParseBlocksOptions {
  version?: number;
}

interface ParsedBlockInput {
  type: BlockType;
  text: string;
}

const HEADING_PATTERN = /^#{1,6}\s+/;
const UNORDERED_LIST_PATTERN = /^[-*]\s+/;
const ORDERED_LIST_PATTERN = /^\d+[.)]\s+/;

export function parseBlocks(rawText: string, options: ParseBlocksOptions = {}): Block[] {
  assertWithinWordLimit(rawText);

  const version = options.version ?? 1;
  const chunks = rawText
    .split(/\n\s*\n/u)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  return chunks.map((chunk, index) => toBlock(parseChunk(chunk), version, index));
}

function parseChunk(chunk: string): ParsedBlockInput {
  const lines = chunk
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { type: "paragraph", text: "" };
  }

  if (lines.every((line) => line.startsWith(">"))) {
    return {
      type: "quote",
      text: lines.map((line) => line.replace(/^>\s?/u, "")).join("\n")
    };
  }

  if (lines.every(isListLine)) {
    return {
      type: "list",
      text: lines.map(stripListMarker).join("\n")
    };
  }

  if (lines.length === 1 && HEADING_PATTERN.test(lines[0] ?? "")) {
    return {
      type: "heading",
      text: (lines[0] ?? "").replace(HEADING_PATTERN, "").trim()
    };
  }

  return {
    type: "paragraph",
    text: lines.join("\n")
  };
}

function isListLine(line: string): boolean {
  return UNORDERED_LIST_PATTERN.test(line) || ORDERED_LIST_PATTERN.test(line);
}

function stripListMarker(line: string): string {
  return line.replace(UNORDERED_LIST_PATTERN, "").replace(ORDERED_LIST_PATTERN, "").trim();
}

function toBlock(input: ParsedBlockInput, version: number, index: number): Block {
  return {
    id: createBlockId(input, index),
    version,
    type: input.type,
    text: input.text,
    spans: [],
    signals: []
  };
}

function createBlockId(input: ParsedBlockInput, index: number): string {
  const hash = createHash("sha256").update(`${index}:${input.type}:${input.text}`).digest("hex").slice(0, 16);
  return `block_${hash}`;
}
