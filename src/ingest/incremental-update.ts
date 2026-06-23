import fs from "node:fs/promises";
import path from "node:path";
import type { CorpusManifest, Episode } from "../domain/episode";
import type { SearchEngine } from "../search/search-engine";
import type { CorpusStore } from "../service/corpus-store";
import { buildEpisodeTopicIndex } from "./build-index";
import { buildManifest, writeManifest } from "./build-manifest";
import { type CorpusDiff, diffCorpus } from "./diff-corpus";
import { enrichTopicIndex } from "./enrich-topics";
import { type Corpus, loadCorpus } from "./load-corpus";

export interface IncrementalUpdateResult {
  diff: CorpusDiff;
  reindexedAll: boolean;
  manifest: CorpusManifest;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function getCacheFile(dataDir: string): string {
  return path.join(dataDir, ".cache", "flexsearch-index.json");
}

async function clearIndexCache(dataDir: string): Promise<void> {
  try {
    await fs.rm(getCacheFile(dataDir), { force: true });
  } catch {
    // ignore
  }
}

export async function applyIncrementalUpdate(
  store: CorpusStore,
  engine: SearchEngine,
  dataDir: string,
  corpusName: string
): Promise<IncrementalUpdateResult> {
  const diff = await diffCorpus(store.manifest, dataDir);

  const hasAnyChange =
    diff.addedEpisodes.length > 0 ||
    diff.changedEpisodes.length > 0 ||
    diff.removedEpisodes.length > 0 ||
    diff.addedTopics.length > 0 ||
    diff.changedTopics.length > 0 ||
    diff.removedTopics.length > 0;

  if (!hasAnyChange) {
    return { diff, reindexedAll: false, manifest: store.manifest };
  }

  const corpus = await loadCorpus(dataDir);
  const manifest = await buildManifest(corpus, { name: corpusName, dataDir });

  const topicIndexChanged =
    diff.addedTopics.length > 0 || diff.changedTopics.length > 0 || diff.removedTopics.length > 0;

  if (topicIndexChanged) {
    const baseTopicIndex = buildEpisodeTopicIndex(corpus.episodes, corpus.topics);
    const topicIndex = enrichTopicIndex(corpus.episodes, corpus.topics, baseTopicIndex);

    const oldSlugs = Array.from(store.episodes.keys());
    await engine.removeDocuments(oldSlugs);
    await engine.addDocuments(corpus.episodes);

    store.episodes = new Map(corpus.episodes.map((e) => [e.slug, e]));
    store.topics = new Map(corpus.topics.map((t) => [t.slug, t]));
    store.topicIndex = topicIndex;
    store.manifest = manifest;

    await writeManifest(manifest, path.join(dataDir, "manifest.json"));
    await clearIndexCache(dataDir);

    return { diff, reindexedAll: true, manifest };
  }

  const slugsToRemove = unique([...diff.removedEpisodes, ...diff.changedEpisodes]);
  const slugsToAdd = unique([...diff.addedEpisodes, ...diff.changedEpisodes]);
  const episodesToAdd = slugsToAdd
    .map((slug) => corpus.episodes.find((e) => e.slug === slug))
    .filter((e): e is Episode => e !== undefined);

  if (slugsToRemove.length > 0) {
    await engine.removeDocuments(slugsToRemove);
  }
  if (episodesToAdd.length > 0) {
    await engine.addDocuments(episodesToAdd);
  }

  for (const slug of diff.removedEpisodes) {
    store.episodes.delete(slug);
  }
  for (const episode of episodesToAdd) {
    store.episodes.set(episode.slug, episode);
  }
  store.manifest = manifest;

  await writeManifest(manifest, path.join(dataDir, "manifest.json"));
  await clearIndexCache(dataDir);

  return { diff, reindexedAll: false, manifest };
}

export async function canIncrementalUpdate(
  manifest: CorpusManifest,
  dataDir: string
): Promise<boolean> {
  const diff = await diffCorpus(manifest, dataDir);
  return (
    diff.addedEpisodes.length > 0 ||
    diff.changedEpisodes.length > 0 ||
    diff.removedEpisodes.length > 0 ||
    diff.addedTopics.length > 0 ||
    diff.changedTopics.length > 0 ||
    diff.removedTopics.length > 0
  );
}

export { type Corpus, type CorpusDiff, diffCorpus };
