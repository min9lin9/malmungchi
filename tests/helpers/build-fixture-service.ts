import path from "node:path";
import { buildEpisodeTopicIndex } from "../../src/ingest/build-index";
import { buildManifest } from "../../src/ingest/build-manifest";
import { enrichTopicIndex } from "../../src/ingest/enrich-topics";
import { loadCorpus } from "../../src/ingest/load-corpus";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";
import { CorpusStore } from "../../src/service/corpus-store";
import { PodcastService } from "../../src/service/podcast-service";

const FIXTURE_DIR = path.join(import.meta.dir, "..", "fixtures");

export async function buildFixturePodcastService() {
  const corpus = await loadCorpus(FIXTURE_DIR);
  const manifest = await buildManifest(corpus, {
    name: "fixture-corpus",
    dataDir: FIXTURE_DIR,
  });
  const baseIndex = buildEpisodeTopicIndex(corpus.episodes, corpus.topics);
  const topicIndex = enrichTopicIndex(corpus.episodes, corpus.topics, baseIndex);

  const store = new CorpusStore(
    new Map(corpus.episodes.map((e) => [e.slug, e])),
    new Map(corpus.topics.map((t) => [t.slug, t])),
    topicIndex,
    manifest
  );

  const engine = new FlexSearchEngine();
  await engine.build(corpus.episodes, topicIndex.episodeToTopics);

  return new PodcastService(store, engine);
}
