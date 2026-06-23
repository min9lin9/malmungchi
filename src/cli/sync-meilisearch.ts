import { loadCorpusAndManifest } from "../bootstrap";
import { env } from "../config/env";
import { buildDocumentCategoryIndex } from "../ingest/build-index";
import { enrichCategoryIndex } from "../ingest/enrich-categories";
import { MeilisearchEngine } from "../search/meilisearch-engine";
import { logger } from "../util/logger";

async function main() {
  logger.info(`Syncing Meilisearch index ${env.meiliIndexName}...`);

  const { corpus } = await loadCorpusAndManifest(env.dataDir, env.corpusName);
  const baseIndex = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
  const categoryIndex = enrichCategoryIndex(corpus.documents, corpus.categories, baseIndex);

  const engine = new MeilisearchEngine({
    host: env.meiliHost,
    apiKey: env.meiliApiKey,
    indexName: env.meiliIndexName,
  });

  await engine.build(corpus.documents, categoryIndex.documentToCategories);

  const stats = engine.getStats();
  logger.info("Meilisearch sync complete", { indexedCount: stats.indexedCount });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
