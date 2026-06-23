import path from "node:path";
import { buildEpisodeTopicIndex } from "../../src/ingest/build-index";
import { enrichTopicIndex } from "../../src/ingest/enrich-topics";
import { loadCorpus } from "../../src/ingest/load-corpus";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";

const DATA_DIR = path.join(import.meta.dir, "..", "..", "data");

export async function buildEngine() {
  const corpus = await loadCorpus(DATA_DIR);
  const baseIndex = buildEpisodeTopicIndex(corpus.episodes, corpus.topics);
  const index = enrichTopicIndex(corpus.episodes, corpus.topics, baseIndex);
  const engine = new FlexSearchEngine();
  await engine.build(corpus.episodes, index.episodeToTopics, {
    dataDir: DATA_DIR,
  });
  return engine;
}
