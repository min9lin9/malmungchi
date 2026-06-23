import { describe, expect, it } from "bun:test";
import type { Episode, SearchResult } from "../../src/domain/episode";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";

function episode(slug: string, transcript: string): Episode {
  return {
    slug,
    metadata: { title: slug },
    content: transcript,
    transcript,
    wordCount: transcript.split(/\s+/).length,
  };
}

describe("FlexSearchEngine semantic rerank", () => {
  it("reranks only the top candidate pool before pagination", async () => {
    const seen: string[][] = [];
    const engine = new FlexSearchEngine({
      maxResults: 5,
      reranker: {
        rerank: async (_query: string, results: readonly SearchResult[]) => {
          seen.push(results.map((result) => result.slug));
          return [...results].reverse();
        },
      },
    });
    await engine.build(
      Array.from({ length: 120 }, (_, index) => episode(`doc-${index}`, "alpha shared")),
      new Map()
    );

    const { results } = await engine.searchWithTotal({ query: "alpha", limit: 5, rerank: true });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(100);
    expect(results).toHaveLength(5);
    expect(results[0].slug).toBe(seen[0][99]);
  });

  it("keeps keyword order when rerank is disabled or fails", async () => {
    const engine = new FlexSearchEngine({
      maxResults: 5,
      reranker: {
        rerank: async () => {
          throw new Error("embedding timeout");
        },
      },
    });
    await engine.build([episode("first", "alpha alpha"), episode("second", "alpha")], new Map());

    const withoutRerank = await engine.search({ query: "alpha", limit: 2, rerank: false });
    const failedRerank = await engine.search({ query: "alpha", limit: 2, rerank: true });

    expect(failedRerank.map((result) => result.slug)).toEqual(
      withoutRerank.map((result) => result.slug)
    );
  });

  it("marks ranking explanations when semantic rerank is applied", async () => {
    const engine = new FlexSearchEngine({
      maxResults: 5,
      reranker: {
        rerank: async (_query: string, results: readonly SearchResult[]) =>
          [...results].reverse().map((result, index) => ({ ...result, score: 1 - index * 0.1 })),
      },
    });
    await engine.build([episode("first", "alpha"), episode("second", "alpha")], new Map());

    const results = await engine.search({ query: "alpha", limit: 2, explain: true });

    expect(results[0].rankingSignals?.rerank).toEqual({ attempted: true, applied: true });
  });
});
