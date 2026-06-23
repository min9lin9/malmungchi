import type { Env } from "../config/env";
import { logger } from "../util/logger";
import { FlexSearchEngine } from "./flexsearch-engine";
import { ApiEmbeddingProvider } from "./rerank/api-embedding-provider";
import { EmbeddingCache } from "./rerank/embedding-cache";
import { EmbeddingReranker } from "./rerank/embedding-reranker";
import type { SearchEngine } from "./search-engine";

export async function createSearchEngine(env: Env): Promise<SearchEngine> {
  if (env.searchEngine === "meilisearch") {
    const { MeilisearchEngine } = await import("./meilisearch-engine.js");
    logger.info("Search engine configured", {
      engine: "meilisearch",
      meiliHost: env.meiliHost,
      meiliIndexName: env.meiliIndexName,
    });
    return new MeilisearchEngine({
      host: env.meiliHost,
      apiKey: env.meiliApiKey,
      indexName: env.meiliIndexName,
    });
  }

  logger.info("Search engine configured", { engine: "flexsearch" });
  return new FlexSearchEngine({
    maxResults: env.maxResults,
    dataDir: env.dataDir,
    cacheFileName: "flexsearch-index.json",
    reranker: new EmbeddingReranker({
      provider: new ApiEmbeddingProvider(env),
      cache: new EmbeddingCache(env.embeddingCacheDir),
    }),
  });
}
