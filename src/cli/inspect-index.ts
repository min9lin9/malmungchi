import { loadCorpusAndManifest } from "../bootstrap";
import { env } from "../config/env";
import { buildEpisodeTopicIndex } from "../ingest/build-index";
import { enrichTopicIndex } from "../ingest/enrich-topics";
import { FlexSearchEngine } from "../search/flexsearch-engine";
import { logger } from "../util/logger";

async function main() {
  logger.info(`Inspecting index in ${env.dataDir}...`);

  const { corpus, manifest } = await loadCorpusAndManifest(env.dataDir, env.corpusName);

  const baseTopicIndex = buildEpisodeTopicIndex(corpus.episodes, corpus.topics);
  const topicIndex = enrichTopicIndex(corpus.episodes, corpus.topics, baseTopicIndex);
  const engine = new FlexSearchEngine();
  await engine.build(corpus.episodes, topicIndex.episodeToTopics);

  const episodesWithoutTopics = corpus.episodes.filter(
    (e: { slug: string }) => (topicIndex.episodeToTopics.get(e.slug)?.length ?? 0) === 0
  );

  const topicEpisodeCounts = Array.from(topicIndex.topicToEpisodes.entries())
    .map(([slug, slugs]) => ({ slug, count: slugs.length }))
    .sort((a, b) => b.count - a.count);

  console.log(
    JSON.stringify(
      {
        manifest,
        episodes: corpus.episodes.length,
        topics: corpus.topics.length,
        episodesWithoutTopics: episodesWithoutTopics.length,
        topTopics: topicEpisodeCounts.slice(0, 10),
        bottomTopics: topicEpisodeCounts.slice(-10),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
