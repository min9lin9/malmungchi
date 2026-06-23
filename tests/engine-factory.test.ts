import { describe, expect, it } from "bun:test";
import type { Env } from "../src/config/env";
import type { DocumentRecord } from "../src/domain/document";
import { createSearchEngine } from "../src/search/engine-factory";
import { FlexSearchEngine } from "../src/search/flexsearch-engine";
import { MeilisearchEngine } from "../src/search/meilisearch-engine";

const baseEnv: Env = {
  dataDir: "/tmp/data",
  documentsDir: "/tmp/data/documents",
  categoriesDir: "/tmp/data/categories",
  blogsDir: "/tmp/data/blogs",
  authorsDir: "/tmp/data/authors",
  authorImportDir: "/tmp/data/imports",
  manifestPath: "/tmp/data/manifest.json",
  transport: "stdio",
  maxResults: 10,
  maxResponseChars: 1000,
  searchEngine: "flexsearch",
  httpHost: "127.0.0.1",
  httpPort: 3000,
  corpusName: "test",
  rateLimitRpm: 60,
  corsOrigin: "*",
  meiliHost: "http://localhost:7700",
  meiliApiKey: undefined,
  meiliIndexName: "test-index",
  openaiChatModel: "gpt-4o-mini",
  codexAuthPath: "/tmp/missing-auth.json",
  kimiBaseUrl: "https://api.moonshot.ai/v1",
  embeddingProvider: "openai",
  embeddingModel: "text-embedding-3-small",
  embeddingDimension: 1536,
  embeddingCacheDir: "/tmp/data/.cache/embeddings",
};

describe("createSearchEngine", () => {
  it("returns FlexSearchEngine by default", async () => {
    const engine = await createSearchEngine(baseEnv);
    expect(engine).toBeInstanceOf(FlexSearchEngine);
  });

  it("returns MeilisearchEngine when configured", async () => {
    const engine = await createSearchEngine({ ...baseEnv, searchEngine: "meilisearch" });
    expect(engine).toBeInstanceOf(MeilisearchEngine);
  });
});

function document(slug: string, transcript: string): DocumentRecord {
  return {
    slug,
    metadata: { title: slug },
    content: transcript,
    transcript,
    wordCount: transcript.split(/\s+/u).length,
    contentHash: `${slug}-hash`,
  };
}

it("wires semantic rerank for flexsearch when embedding auth is configured", async () => {
  const originalFetch = globalThis.fetch;
  const mockFetch = async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { input?: string };
    const text = body.input ?? "";
    const embedding = text.includes("semantic") || text === "alpha" ? [1, 0] : [0, 1];
    return new Response(JSON.stringify({ data: [{ embedding }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  globalThis.fetch = Object.assign(mockFetch, { preconnect: originalFetch.preconnect });
  try {
    const engine = await createSearchEngine({
      ...baseEnv,
      openaiApiKey: "sk-test",
      codexAuthPath: "/tmp/missing-auth.json",
    });
    await engine.build(
      [document("keyword", "alpha keyword"), document("semantic", "alpha semantic")],
      new Map()
    );

    const reranked = await engine.search({ query: "alpha", limit: 2, rerank: true });
    const keyword = await engine.search({ query: "alpha", limit: 2, rerank: false });

    expect(keyword[0].slug).toBe("keyword");
    expect(reranked[0].slug).toBe("semantic");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
