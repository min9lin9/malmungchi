import path from "node:path";
import { env } from "./config/env";
import type { CorpusManifest } from "./domain/episode";
import { buildEpisodeTopicIndex } from "./ingest/build-index";
import { buildManifest, readManifest, writeManifest } from "./ingest/build-manifest";
import { enrichTopicIndex } from "./ingest/enrich-topics";
import { type Corpus, loadCorpus } from "./ingest/load-corpus";
import { createSearchEngine } from "./search/engine-factory";
import { CorpusStore } from "./service/corpus-store";
import { PodcastService } from "./service/podcast-service";
import { logger } from "./util/logger";

export interface BootstrapResult {
  corpus: Corpus;
  manifest: CorpusManifest;
}

export async function loadCorpusAndManifest(
  dataDir: string,
  corpusName: string
): Promise<BootstrapResult> {
  const manifestPath = path.join(dataDir, "manifest.json");
  const corpus = await loadCorpus(dataDir);

  let manifest = await readManifest(manifestPath);
  if (!manifest) {
    manifest = await buildManifest(corpus, { name: corpusName, dataDir });
    await writeManifest(manifest, manifestPath);
    logger.info("manifest rebuilt", { manifestPath });
  }

  return { corpus, manifest };
}

export async function buildService(dataDir: string, corpusName: string): Promise<PodcastService> {
  const { corpus, manifest } = await loadCorpusAndManifest(dataDir, corpusName);
  const defaultImportDir = path.join(env.dataDir, "imports");
  const authorImportDir =
    env.authorImportDir === defaultImportDir ? path.join(dataDir, "imports") : env.authorImportDir;
  const serviceEnv = {
    ...env,
    dataDir,
    episodesDir: path.join(dataDir, "documents"),
    topicsDir: path.join(dataDir, "categories"),
    blogsDir: path.join(dataDir, "sources"),
    authorsDir: path.join(dataDir, "authors"),
    authorImportDir,
    manifestPath: path.join(dataDir, "manifest.json"),
    embeddingCacheDir: path.join(dataDir, ".cache", "embeddings"),
  };

  const baseTopicIndex = buildEpisodeTopicIndex(corpus.episodes, corpus.topics);
  const topicIndex = enrichTopicIndex(corpus.episodes, corpus.topics, baseTopicIndex);

  const store = new CorpusStore(
    new Map(corpus.episodes.map((e: Corpus["episodes"][number]) => [e.slug, e])),
    new Map(corpus.topics.map((t: Corpus["topics"][number]) => [t.slug, t])),
    topicIndex,
    manifest
  );

  const engine = await createSearchEngine(serviceEnv);
  await engine.build(corpus.episodes, topicIndex.episodeToTopics, {
    dataDir,
    manifest,
  });

  return new PodcastService(store, engine, serviceEnv);
}

export async function rebuildManifest(
  dataDir: string,
  corpusName: string
): Promise<CorpusManifest> {
  const corpus = await loadCorpus(dataDir);
  const manifest = await buildManifest(corpus, { name: corpusName, dataDir });
  await writeManifest(manifest, path.join(dataDir, "manifest.json"));
  return manifest;
}
