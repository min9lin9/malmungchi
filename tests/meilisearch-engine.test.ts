import { describe, expect, it } from "bun:test";
import type { DocumentRecord } from "../src/domain/document";
import { MeilisearchEngine } from "../src/search/meilisearch-engine";

function createFakeClient(
  hits: Array<{
    slug: string;
    title: string;
    guest: string;
    publishDate?: string;
    categorySlugs?: string;
    _formatted?: { transcript?: string };
    _rankingScore?: number;
  }> = []
) {
  const settingsCalls: unknown[] = [];
  const addCalls: unknown[][] = [];
  const deleteCalls: string[][] = [];

  const fakeIndex = {
    updateSettings: async (settings: unknown) => {
      settingsCalls.push(settings);
    },
    addDocuments: (docs: unknown[]) => {
      addCalls.push(docs);
      return Object.assign(Promise.resolve({ taskUid: 1 }), {
        waitTask: async () => ({ uid: 1, status: "succeeded" }),
      });
    },
    deleteDocuments: (ids: string[]) => {
      deleteCalls.push(ids);
      return Object.assign(Promise.resolve({ taskUid: 2 }), {
        waitTask: async () => ({ uid: 2, status: "succeeded" }),
      });
    },
    search: async (_query: string, options: unknown) => {
      settingsCalls.push({ searchOptions: options });
      return {
        hits,
        estimatedTotalHits: hits.length,
      };
    },
  };

  return {
    settingsCalls,
    addCalls,
    deleteCalls,
    client: {
      createIndex: async () => ({ uid: "test-index" }),
      index: () => fakeIndex,
    },
  };
}

describe("MeilisearchEngine", () => {
  function installFakeClient(
    engine: MeilisearchEngine,
    client: ReturnType<typeof createFakeClient>["client"]
  ): void {
    Object.defineProperty(engine, "client", { value: client });
  }

  it("build indexes documents and configures settings", async () => {
    const fake = createFakeClient();
    const engine = new MeilisearchEngine({ host: "http://localhost:7700", indexName: "test" });
    installFakeClient(engine, fake.client);

    const document: DocumentRecord = {
      slug: "ep-1",
      metadata: {
        title: "DocumentRecord 1",
        guest: "Alice",
        publish_date: "2024-01-01",
        keywords: ["alpha"],
      },
      content: "Alpha content",
      transcript: "Alpha content here.",
      wordCount: 3,
    };

    await engine.build([document], new Map([["ep-1", ["category-a"]]]));
    expect(engine.getStats().indexedCount).toBe(1);
    expect(fake.addCalls).toHaveLength(1);
    expect(fake.addCalls[0]).toHaveLength(1);
    expect(fake.settingsCalls).toHaveLength(1);
  });

  it("returns empty results for empty query response", async () => {
    const fake = createFakeClient();
    const engine = new MeilisearchEngine({ host: "http://localhost:7700", indexName: "test" });
    installFakeClient(engine, fake.client);

    await engine.build([], new Map());
    const result = await engine.searchWithTotal({ query: "alpha", limit: 10 });
    expect(result.results).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("maps search hits with snippets and category slugs", async () => {
    const hits = [
      {
        slug: "ep-1",
        title: "DocumentRecord 1",
        guest: "Alice",
        publishDate: "2024-01-01",
        categorySlugs: "category-a",
        _formatted: { transcript: "... <mark>alpha</mark> content ..." },
        _rankingScore: 0.95,
      },
    ];
    const fake = createFakeClient(hits);
    const engine = new MeilisearchEngine({ host: "http://localhost:7700", indexName: "test" });
    installFakeClient(engine, fake.client);

    await engine.build(
      [
        {
          slug: "ep-1",
          metadata: { title: "DocumentRecord 1", guest: "Alice", publish_date: "2024-01-01" },
          content: "content",
          transcript: "content",
          wordCount: 1,
        },
      ],
      new Map([["ep-1", ["category-a"]]])
    );

    const result = await engine.searchWithTotal({ query: "alpha", limit: 10 });
    expect(result.total).toBe(1);
    expect(result.results[0].slug).toBe("ep-1");
    expect(result.results[0].score).toBe(0.95);
    expect(fake.settingsCalls).toContainEqual(
      expect.objectContaining({
        searchOptions: expect.objectContaining({ showRankingScore: true }),
      })
    );
    expect(result.results[0].snippet).toContain("<mark>alpha</mark>");
    expect(result.results[0].categorySlugs).toEqual(["category-a"]);
  });

  it("uses honest explain signals for Meilisearch scores", async () => {
    const fake = createFakeClient([
      {
        slug: "ep-1",
        title: "DocumentRecord 1",
        guest: "Alice",
        _formatted: { transcript: "... <mark>alpha</mark> content ..." },
      },
    ]);
    const engine = new MeilisearchEngine({ host: "http://localhost:7700", indexName: "test" });
    installFakeClient(engine, fake.client);

    await engine.build([], new Map());
    const result = await engine.searchWithTotal({
      query: "alpha",
      rankingMode: "rrf",
      explain: true,
    });

    expect(fake.settingsCalls).toContainEqual(
      expect.objectContaining({
        searchOptions: expect.objectContaining({ showRankingScore: true }),
      })
    );
    expect(result.results[0].rankingMode).toBe("rrf");
    expect(result.results[0].rankingSignals).toBeUndefined();
    expect(result.results[0].score).toBe(0);
  });

  it("maps Meilisearch ranking score into normalized explain evidence when available", async () => {
    const fake = createFakeClient([
      {
        slug: "ep-1",
        title: "DocumentRecord 1",
        guest: "Alice",
        _formatted: { transcript: "... <mark>alpha</mark> content ..." },
        _rankingScore: 0.7,
      },
    ]);
    const engine = new MeilisearchEngine({ host: "http://localhost:7700", indexName: "test" });
    installFakeClient(engine, fake.client);

    await engine.build([], new Map());
    const result = await engine.searchWithTotal({ query: "alpha", explain: true });

    expect(result.results[0].rankingSignals).toEqual({
      matchedFields: ["meilisearch"],
      fieldScores: { meilisearch: 0.7 },
      rawScore: 0.7,
      normalizedScore: 0.7,
      rankingMode: "weighted",
      normalizedFieldScores: { meilisearch: 1 },
      evidence: [{ field: "transcript", snippet: "... <mark>alpha</mark> content ..." }],
      rerank: { attempted: false, applied: false, reason: "engine-managed" },
    });
  });

  it("addDocuments and removeDocuments update indexedCount", async () => {
    const fake = createFakeClient();
    const engine = new MeilisearchEngine({ host: "http://localhost:7700", indexName: "test" });
    installFakeClient(engine, fake.client);

    await engine.build([], new Map());

    const document: DocumentRecord = {
      slug: "ep-1",
      metadata: { title: "DocumentRecord 1", guest: "Alice" },
      content: "content",
      transcript: "content",
      wordCount: 1,
    };

    await engine.addDocuments([document]);
    expect(engine.getStats().indexedCount).toBe(1);
    expect(fake.addCalls).toHaveLength(1);

    await engine.removeDocuments(["ep-1"]);
    expect(engine.getStats().indexedCount).toBe(0);
    expect(fake.deleteCalls).toHaveLength(1);
  });
});
