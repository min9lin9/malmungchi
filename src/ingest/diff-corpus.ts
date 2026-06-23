import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadAllAuthorPosts } from "../author/storage/author-storage";
import type { CorpusManifest } from "../domain/episode";

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export interface CorpusDiff {
  addedEpisodes: string[];
  changedEpisodes: string[];
  removedEpisodes: string[];
  addedTopics: string[];
  changedTopics: string[];
  removedTopics: string[];
}

async function* readJsonlLines(filePath: string): AsyncGenerator<{ raw: string; data: unknown }> {
  const raw = await fs.readFile(filePath, "utf-8");
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      yield { raw: line, data: JSON.parse(line) };
    } catch (err) {
      throw new Error(
        `Invalid JSON at ${filePath}:${i + 1}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

async function scanMarkdownEpisodeHashes(episodesDir: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  try {
    const episodeSlugs = await fs.readdir(episodesDir);
    for (const slug of episodeSlugs) {
      const filePath = path.join(episodesDir, slug, "transcript.md");
      try {
        const content = await fs.readFile(filePath, "utf-8");
        hashes[slug] = hashContent(content);
      } catch {
        // skip directories without transcript.md
      }
    }
  } catch {
    // episodesDir may not exist
  }
  return hashes;
}

async function scanJsonlEpisodeHashes(jsonlPath: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  try {
    for await (const { raw, data } of readJsonlLines(jsonlPath)) {
      if (typeof data === "object" && data !== null && "slug" in data) {
        const slug = String((data as Record<string, unknown>).slug);
        if (slug) hashes[slug] = hashContent(raw);
      }
    }
  } catch {
    // JSONL file may not exist
  }
  return hashes;
}

async function scanAuthorPostHashes(authorsDir: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const post of await loadAllAuthorPosts(authorsDir)) {
    hashes[post.slug] = post.contentHash;
  }
  return hashes;
}

async function scanMarkdownTopicHashes(topicsDir: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  try {
    const topicFiles = await fs.readdir(topicsDir);
    for (const file of topicFiles) {
      if (!file.endsWith(".md")) continue;
      const slug = file.slice(0, -3);
      const content = await fs.readFile(path.join(topicsDir, file), "utf-8");
      hashes[slug] = hashContent(content);
    }
  } catch {
    // topicsDir may not exist
  }
  return hashes;
}

async function scanJsonlTopicHashes(jsonlPath: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  try {
    for await (const { raw, data } of readJsonlLines(jsonlPath)) {
      if (typeof data === "object" && data !== null && "slug" in data) {
        const slug = String((data as Record<string, unknown>).slug);
        if (slug) hashes[slug] = hashContent(raw);
      }
    }
  } catch {
    // JSONL file may not exist
  }
  return hashes;
}

export async function diffCorpus(manifest: CorpusManifest, dataDir: string): Promise<CorpusDiff> {
  const episodesDir = path.join(dataDir, "episodes");
  const topicsDir = path.join(dataDir, "topics");

  const currentEpisodeHashes: Record<string, string> = {
    ...(await scanMarkdownEpisodeHashes(episodesDir)),
    ...(await scanJsonlEpisodeHashes(path.join(dataDir, "episodes.jsonl"))),
    ...(await scanAuthorPostHashes(path.join(dataDir, "authors"))),
  };

  const currentTopicHashes: Record<string, string> = {
    ...(await scanMarkdownTopicHashes(topicsDir)),
    ...(await scanJsonlTopicHashes(path.join(dataDir, "topics.jsonl"))),
  };

  const addedEpisodes = Object.keys(currentEpisodeHashes).filter(
    (slug) => !manifest.episodeHashes[slug]
  );
  const changedEpisodes = Object.keys(currentEpisodeHashes).filter(
    (slug) =>
      manifest.episodeHashes[slug] && manifest.episodeHashes[slug] !== currentEpisodeHashes[slug]
  );
  const removedEpisodes = Object.keys(manifest.episodeHashes).filter(
    (slug) => !currentEpisodeHashes[slug]
  );

  const addedTopics = Object.keys(currentTopicHashes).filter((slug) => !manifest.topicHashes[slug]);
  const changedTopics = Object.keys(currentTopicHashes).filter(
    (slug) => manifest.topicHashes[slug] && manifest.topicHashes[slug] !== currentTopicHashes[slug]
  );
  const removedTopics = Object.keys(manifest.topicHashes).filter(
    (slug) => !currentTopicHashes[slug]
  );

  return {
    addedEpisodes,
    changedEpisodes,
    removedEpisodes,
    addedTopics,
    changedTopics,
    removedTopics,
  };
}
