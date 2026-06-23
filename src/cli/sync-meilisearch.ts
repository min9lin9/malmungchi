import { loadCorpusAndManifest } from "../bootstrap";
import { env } from "../config/env";
import { buildEpisodeTopicIndex } from "../ingest/build-index";
import { enrichTopicIndex } from "../ingest/enrich-topics";
import { MeilisearchEngine } from "../search/meilisearch-engine";
import { logger } from "../util/logger";

async function main() {
  logger.info(`Syncing Meilisearch index ${env.meiliIndexName}...`);

  const { corpus } = await loadCorpusAndManifest(env.dataDir, env.corpusName);
  const baseIndex = buildEpisodeTopicIndex(corpus.episodes, corpus.topics);
  const topicIndex = enrichTopicIndex(corpus.episodes, corpus.topics, baseIndex);

  const engine = new MeilisearchEngine({
    host: env.meiliHost,
    apiKey: env.meiliApiKey,
    indexName: env.meiliIndexName,
  });

  await engine.build(corpus.episodes, topicIndex.episodeToTopics);

  const stats = engine.getStats();
  logger.info("Meilisearch sync complete", { indexedCount: stats.indexedCount });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
