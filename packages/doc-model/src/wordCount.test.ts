import { describe, expect, it } from "vitest";
import { countWords, MAX_ARTICLE_WORDS, validateWordLimit } from "./wordCount.js";

describe("word count", () => {
  it("counts words in pasted prose", () => {
    expect(countWords("Revenue grew 42% year-over-year.\n\nMargins improved too.")).toBe(7);
  });

  it("accepts articles up to 5,000 words", () => {
    const text = Array.from({ length: MAX_ARTICLE_WORDS }, (_, index) => `word${index}`).join(" ");

    expect(validateWordLimit(text)).toEqual({ ok: true, wordCount: 5000 });
  });

  it("rejects articles over 5,000 words", () => {
    const text = Array.from({ length: MAX_ARTICLE_WORDS + 1 }, (_, index) => `word${index}`).join(" ");

    expect(validateWordLimit(text)).toEqual({
      ok: false,
      wordCount: 5001,
      maxWords: 5000,
      message: "Article is 5,001 words; the MVP limit is 5,000 words."
    });
  });
});
