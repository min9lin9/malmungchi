import path from "node:path";
import { buildEpisodeTopicIndex } from "../../src/ingest/build-index";
import { enrichTopicIndex } from "../../src/ingest/enrich-topics";
import { loadCorpus } from "../../src/ingest/load-corpus";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";

const FIXTURE_DIR = path.join(import.meta.dir, "..", "fixtures");

export async function buildFixtureEngine() {
  const corpus = await loadCorpus(FIXTURE_DIR);
  const baseIndex = buildEpisodeTopicIndex(corpus.episodes, corpus.topics);
  const index = enrichTopicIndex(corpus.episodes, corpus.topics, baseIndex);
  const engine = new FlexSearchEngine();
  await engine.build(corpus.episodes, index.episodeToTopics);
  return engine;
}
