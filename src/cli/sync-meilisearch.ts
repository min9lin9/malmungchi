import { loadDocumentsAndManifest } from "../bootstrap";
import { env } from "../config/env";
import { buildDocumentCategoryIndex } from "../ingest/build-index";
import { enrichCategoryIndex } from "../ingest/enrich-categories";
import { MeilisearchEngine } from "../search/meilisearch-engine";
import { logger } from "../util/logger";

async function main() {
  logger.info(`Syncing Meilisearch index ${env.meiliIndexName}...`);

  const { malmunchi } = await loadDocumentsAndManifest(env.dataDir, env.instanceName);
  const baseIndex = buildDocumentCategoryIndex(malmunchi.documents, malmunchi.categories);
  const categoryIndex = enrichCategoryIndex(malmunchi.documents, malmunchi.categories, baseIndex);

  const engine = new MeilisearchEngine({
    host: env.meiliHost,
    apiKey: env.meiliApiKey,
    indexName: env.meiliIndexName,
  });

  await engine.build(malmunchi.documents, categoryIndex.documentToCategories);

  const stats = engine.getStats();
  logger.info("Meilisearch sync complete", { indexedCount: stats.indexedCount });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
