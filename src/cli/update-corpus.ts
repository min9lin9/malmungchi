import { loadCorpusAndManifest } from "../bootstrap";
import { env } from "../config/env";
import { buildEpisodeTopicIndex } from "../ingest/build-index";
import { enrichTopicIndex } from "../ingest/enrich-topics";
import { applyIncrementalUpdate } from "../ingest/incremental-update";
import { FlexSearchEngine } from "../search/flexsearch-engine";
import { CorpusStore } from "../service/corpus-store";
import { logger } from "../util/logger";

async function main() {
  const { corpus, manifest } = await loadCorpusAndManifest(env.dataDir, env.corpusName);

  const baseTopicIndex = buildEpisodeTopicIndex(corpus.episodes, corpus.topics);
  const topicIndex = enrichTopicIndex(corpus.episodes, corpus.topics, baseTopicIndex);

  const store = new CorpusStore(
    new Map(corpus.episodes.map((e) => [e.slug, e])),
    new Map(corpus.topics.map((t) => [t.slug, t])),
    topicIndex,
    manifest
  );

  const engine = new FlexSearchEngine();
  await engine.build(corpus.episodes, topicIndex.episodeToTopics, {
    dataDir: env.dataDir,
    manifest,
  });

  const result = await applyIncrementalUpdate(store, engine, env.dataDir, env.corpusName);

  const diff = result.diff;
  const totalChanges =
    diff.addedEpisodes.length +
    diff.changedEpisodes.length +
    diff.removedEpisodes.length +
    diff.addedTopics.length +
    diff.changedTopics.length +
    diff.removedTopics.length;

  if (totalChanges === 0) {
    logger.info("No corpus changes detected");
    return;
  }

  logger.info("Corpus updated incrementally", {
    ...diff,
    reindexedAll: result.reindexedAll,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
