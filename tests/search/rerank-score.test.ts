import { describe, expect, it } from "bun:test";
import { cosineSimilarity } from "../../src/search/rerank/cosine";
import { combineRerankScores } from "../../src/search/rerank/rerank-score";

describe("rerank score", () => {
  it("maps identical vectors to similarity 1", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
  });

  it("maps orthogonal vectors to similarity 0", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("throws on dimension mismatch", () => {
    expect(() => cosineSimilarity([1], [1, 0])).toThrow("dimension");
  });

  it("combines normalized keyword score and cosine score using spec weights", () => {
    const scores = combineRerankScores([
      { slug: "a", keywordScore: 10, semanticScore: 0.1 },
      { slug: "b", keywordScore: 20, semanticScore: 0.9 },
    ]);

    expect(scores.map((score) => score.slug)).toEqual(["b", "a"]);
    expect(scores[0].score).toBeCloseTo(0.2 * 1 + 0.8 * 0.95);
    expect(scores[1].score).toBeCloseTo(0.2 * 0 + 0.8 * 0.55);
  });
});
