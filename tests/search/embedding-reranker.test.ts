import { describe, expect, it } from "bun:test";
import type { Episode, SearchResult } from "../../src/domain/episode";
import { EmbeddingReranker } from "../../src/search/rerank/embedding-reranker";

function episode(slug: string): Episode {
  return {
    slug,
    metadata: { title: slug },
    content: slug,
    transcript: slug,
    wordCount: 1,
    contentHash: `${slug}-hash`,
  };
}

function result(slug: string, score: number): SearchResult {
  return {
    slug,
    title: slug,
    guest: "",
    score,
    snippet: "",
    topicSlugs: [],
    sourceType: "podcast",
    sourceId: "podcast",
    rankingMode: "weighted",
  };
}

describe("EmbeddingReranker", () => {
  it("reranks candidates by semantic score", async () => {
    const reranker = new EmbeddingReranker({
      provider: {
        provider: "test",
        model: "test-model",
        dimension: 2,
        embed: async (text) => (text.includes("semantic") || text === "query" ? [1, 0] : [0, 1]),
      },
    });
    await reranker.prepare([episode("keyword"), episode("semantic")]);

    const reranked = await reranker.rerank("query", [result("keyword", 10), result("semantic", 1)]);

    expect(reranked[0].slug).toBe("semantic");
  });

  it("falls back to keyword results when embedding fails", async () => {
    const reranker = new EmbeddingReranker({
      provider: {
        provider: "test",
        model: "test-model",
        dimension: 2,
        embed: async () => {
          throw new Error("provider unavailable");
        },
      },
    });
    const original = [result("keyword", 10), result("semantic", 1)];

    await expect(reranker.rerank("query", original)).resolves.toEqual(original);
  });

  it("invalidates in-memory document embeddings when contentHash changes", async () => {
    const embeddedTexts: string[] = [];
    const reranker = new EmbeddingReranker({
      provider: {
        provider: "test",
        model: "test-model",
        dimension: 2,
        embed: async (text) => {
          embeddedTexts.push(text);
          return text.includes("new") || text === "query" ? [1, 0] : [0, 1];
        },
      },
    });

    await reranker.prepare([episode("same")]);
    await reranker.rerank("query", [result("same", 1)]);
    await reranker.prepare([
      {
        ...episode("same"),
        transcript: "new",
        contentHash: "same-new-hash",
      },
    ]);
    await reranker.rerank("query", [result("same", 1)]);

    expect(embeddedTexts.some((text) => text.includes("new"))).toBe(true);
  });
});
