import type { Block } from "./types.js";

export interface BlockInvalidationResult {
  invalidatedBlockIds: string[];
  retainedBlockIds: string[];
}

/**
 * Compares old and new materialized blocks at the MVP granularity.
 *
 * For now, block state is retained only when a previous block id still exists
 * with the same type and text. Span/signal reconciliation is intentionally out
 * of scope until the document model needs finer-grained editing semantics.
 */
export function diffInvalidatedBlocks(previousBlocks: Block[], nextBlocks: Block[]): BlockInvalidationResult {
  const nextBlocksById = new Map(nextBlocks.map((block) => [block.id, block]));
  const invalidatedBlockIds: string[] = [];
  const retainedBlockIds: string[] = [];

  for (const previousBlock of previousBlocks) {
    const nextBlock = nextBlocksById.get(previousBlock.id);

    if (nextBlock && nextBlock.type === previousBlock.type && nextBlock.text === previousBlock.text) {
      retainedBlockIds.push(previousBlock.id);
      continue;
    }

    invalidatedBlockIds.push(previousBlock.id);
  }

  return { invalidatedBlockIds, retainedBlockIds };
}
