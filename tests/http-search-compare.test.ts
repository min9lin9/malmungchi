import { describe, expect, it } from "bun:test";
import type { CorpusManifest, SearchInput, SearchResult } from "../src/domain/document";
import { createHttpApp } from "../src/http/app";
import type {
  SearchEngine,
  SearchEngineBuildOptions,
  SearchEngineStats,
} from "../src/search/search-engine";
import { CorpusStore } from "../src/service/corpus-store";
import { DocumentService } from "../src/service/document-service";
import { buildFixtureDocumentService } from "./helpers/build-fixture-service";

async function buildApp() {
  return createHttpApp(await buildFixtureDocumentService());
}

describe("http search compare", () => {
  it("search compare reports rank deltas over HTTP", async () => {
    const app = await buildApp();

    const res = await app.handle(new Request("http://localhost/search/compare?q=product&limit=3"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      supported: boolean;
      query: string;
      weightedTop: string[];
      rrfTop: string[];
      overlap: number;
      items: Array<{
        slug: string;
        weightedRank?: number;
        rrfRank?: number;
        rankDelta?: number;
        weightedSignals?: { rankingMode: string };
        rrfSignals?: { rankingMode: string };
      }>;
    };
    expect(body.supported).toBe(true);
    expect(body.query).toBe("product");
    expect(body.weightedTop.length).toBeGreaterThan(0);
    expect(body.rrfTop.length).toBeGreaterThan(0);
    expect(body.overlap).toBeGreaterThanOrEqual(0);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        slug: expect.any(String),
        weightedSignals: expect.objectContaining({ rankingMode: "weighted" }),
        rrfSignals: expect.objectContaining({ rankingMode: "rrf" }),
      })
    );
  });

  it("search compare rejects one-character queries", async () => {
    const app = await buildApp();

    const res = await app.handle(new Request("http://localhost/search/compare?q=a&limit=3"));

    expect(res.status).toBe(400);
  });

  it("search compare reports Meilisearch unsupported fallback", async () => {
    const manifest: CorpusManifest = {
      name: "fake",
      generatedAt: new Date(0).toISOString(),
      documentCount: 0,
      categoryCount: 0,
      indexedDocumentCount: 0,
      contentBytes: 0,
      contentWordCount: 0,
      schemaVersion: 1,
      documentSlugs: [],
      categorySlugs: [],
      documentHashes: {},
      categoryHashes: {},
    };
    const engine = new FakeMeilisearchEngine();
    const service = new DocumentService(
      new CorpusStore(
        new Map(),
        new Map(),
        { documentToCategories: new Map(), categoryToDocuments: new Map() },
        manifest
      ),
      engine
    );
    const app = createHttpApp(service);

    const res = await app.handle(new Request("http://localhost/search/compare?q=memory&limit=3"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      supported: boolean;
      engine: string;
      reason: string;
      weightedTop: unknown[];
      rrfTop: unknown[];
      items: unknown[];
    };
    expect(engine.searchCalls).toBe(0);
    expect(body).toEqual(
      expect.objectContaining({
        supported: false,
        engine: "meilisearch",
        reason: "engine-managed-ranking",
        weightedTop: [],
        rrfTop: [],
        items: [],
      })
    );
  });
});

class FakeMeilisearchEngine implements SearchEngine {
  readonly engineType = "meilisearch";
  searchCalls = 0;

  async build(
    _episodes: unknown[],
    _documentToCategories: Map<string, string[]>,
    _options?: SearchEngineBuildOptions
  ) {}

  async search(_input: SearchInput): Promise<SearchResult[]> {
    this.searchCalls++;
    return [];
  }

  async searchWithTotal(_input: SearchInput): Promise<{ results: SearchResult[]; total: number }> {
    this.searchCalls++;
    return { results: [], total: 0 };
  }

  async addDocuments(_episodes: unknown[]): Promise<void> {}

  async removeDocuments(_slugs: string[]): Promise<void> {}

  getStats(): SearchEngineStats {
    return { indexedCount: 0 };
  }
}
