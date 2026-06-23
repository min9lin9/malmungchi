import { describe, expect, it } from "bun:test";
import path from "node:path";
import { buildEpisodeTopicIndex } from "../src/ingest/build-index";
import { buildManifest } from "../src/ingest/build-manifest";
import { loadCorpus } from "../src/ingest/load-corpus";

const DATA_DIR = path.join(import.meta.dir, "..", "data");

describe("data integrity", () => {
  it("every episode has a slug and title or guest", async () => {
    const corpus = await loadCorpus(DATA_DIR);
    for (const episode of corpus.episodes) {
      expect(episode.slug).toBeTruthy();
      expect(episode.metadata.title || episode.metadata.guest).toBeTruthy();
    }
  });

  it("every topic references real episodes", async () => {
    const corpus = await loadCorpus(DATA_DIR);
    const episodeSlugs = new Set(corpus.episodes.map((e) => e.slug));
    for (const topic of corpus.topics) {
      for (const slug of topic.episodeSlugs) {
        expect(episodeSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("manifest counts match corpus", async () => {
    const corpus = await loadCorpus(DATA_DIR);
    const manifest = await buildManifest(corpus, {
      name: "test-corpus",
      dataDir: DATA_DIR,
    });
    expect(manifest.episodeCount).toBe(corpus.episodes.length);
    expect(manifest.topicCount).toBe(corpus.topics.length);
  });

  it("topic index covers all episodes", async () => {
    const corpus = await loadCorpus(DATA_DIR);
    const index = buildEpisodeTopicIndex(corpus.episodes, corpus.topics);
    expect(index.episodeToTopics.size).toBe(corpus.episodes.length);
  });
});
