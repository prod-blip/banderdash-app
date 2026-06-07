export const MAX_ARTICLE_WORDS = 5000;

export interface AcceptedWordLimit {
  ok: true;
  wordCount: number;
}

export interface RejectedWordLimit {
  ok: false;
  wordCount: number;
  maxWords: number;
  message: string;
}

export type WordLimitResult = AcceptedWordLimit | RejectedWordLimit;

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’%.-][\p{L}\p{N}]+)*/gu;

export function countWords(text: string): number {
  return text.match(WORD_PATTERN)?.length ?? 0;
}

export function validateWordLimit(text: string, maxWords = MAX_ARTICLE_WORDS): WordLimitResult {
  const wordCount = countWords(text);

  if (wordCount <= maxWords) {
    return { ok: true, wordCount };
  }

  return {
    ok: false,
    wordCount,
    maxWords,
    message: `Article is ${wordCount.toLocaleString("en-US")} words; the MVP limit is ${maxWords.toLocaleString(
      "en-US"
    )} words.`
  };
}

export function assertWithinWordLimit(text: string, maxWords = MAX_ARTICLE_WORDS): number {
  const result = validateWordLimit(text, maxWords);

  if (!result.ok) {
    throw new Error(result.message);
  }

  return result.wordCount;
}
