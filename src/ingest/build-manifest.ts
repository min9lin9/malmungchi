import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CORPUS_SCHEMA_VERSION } from "../config/constants";
import type { CorpusManifest } from "../domain/episode";
import { parseManifest } from "../domain/manifest";
import type { Corpus } from "./load-corpus";

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

async function hashFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return hashContent(content);
  } catch {
    return "";
  }
}

export async function buildManifest(
  corpus: Corpus,
  options: { name: string; dataDir: string }
): Promise<CorpusManifest> {
  const { episodes, topics } = corpus;

  let transcriptBytes = 0;
  let transcriptWordCount = 0;
  for (const episode of episodes) {
    transcriptBytes += Buffer.byteLength(episode.content, "utf-8");
    transcriptWordCount += episode.wordCount;
  }

  const episodeHashes: Record<string, string> = {};
  for (const episode of episodes) {
    if (episode.slug.startsWith("blog:")) continue;
    if (episode.contentHash) {
      episodeHashes[episode.slug] = episode.contentHash;
    } else {
      const filePath = path.join(options.dataDir, "episodes", episode.slug, "transcript.md");
      episodeHashes[episode.slug] = await hashFile(filePath);
    }
  }

  const topicHashes: Record<string, string> = {};
  for (const topic of topics) {
    if (topic.contentHash) {
      topicHashes[topic.slug] = topic.contentHash;
    } else {
      const filePath = path.join(options.dataDir, "topics", `${topic.slug}.md`);
      topicHashes[topic.slug] = await hashFile(filePath);
    }
  }

  const manifest: CorpusManifest = {
    name: options.name,
    generatedAt: new Date().toISOString(),
    episodeCount: episodes.length,
    topicCount: topics.length,
    indexedEpisodeCount: episodes.length,
    transcriptBytes,
    transcriptWordCount,
    schemaVersion: CORPUS_SCHEMA_VERSION,
    episodeSlugs: episodes.map((e) => e.slug).sort(),
    topicSlugs: topics.map((t) => t.slug).sort(),
    episodeHashes,
    topicHashes,
  };

  return manifest;
}

export async function writeManifest(manifest: CorpusManifest, manifestPath: string): Promise<void> {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

export async function readManifest(manifestPath: string): Promise<CorpusManifest | null> {
  try {
    const raw = await fs.readFile(manifestPath, "utf-8");
    return parseManifest(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[manifest] failed to read ${manifestPath}: ${error.message}`);
    }
    return null;
  }
}
