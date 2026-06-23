import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { authorPostsToEpisodes } from "../author/corpus/author-to-episode";
import type { AuthorPost } from "../author/domain/author-post";
import { loadAllAuthorPosts } from "../author/storage/author-storage";
import type { Episode, Topic } from "../domain/episode";
import { parseTranscriptFile } from "./parse-transcript";

const EPISODE_LINK_RE = /\[.*?\]\(\.\.\/episodes\/([^/\s)]+)\/transcript\.md\)/g;

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

const EpisodeMetadataSchema = z
  .object({
    guest: z.string().optional(),
    title: z.string().optional(),
    youtube_url: z.string().optional(),
    video_id: z.string().optional(),
    publish_date: z.string().optional(),
    description: z.string().optional(),
    duration_seconds: z.number().optional(),
    duration: z.string().optional(),
    view_count: z.number().optional(),
    channel: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  })
  .passthrough();

const EpisodeJsonlSchema = z.object({
  slug: z.string().min(1),
  metadata: EpisodeMetadataSchema.optional(),
  content: z.string().optional(),
  transcript: z.string().optional(),
  wordCount: z.number().int().nonnegative().optional(),
});

const TopicJsonlSchema = z.object({
  slug: z.string().min(1),
  name: z.string().optional(),
  content: z.string().optional(),
  episodeSlugs: z.array(z.string()).optional(),
});

async function* readJsonlLines(
  filePath: string
): AsyncGenerator<{ lineNumber: number; raw: string; data: unknown }> {
  const raw = await fs.readFile(filePath, "utf-8");
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      yield { lineNumber: i + 1, raw: line, data: JSON.parse(line) };
    } catch (err) {
      throw new Error(
        `Invalid JSON at ${filePath}:${i + 1}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

function parseEpisodeJsonlRecord(record: unknown, raw: string): Episode {
  const parsed = EpisodeJsonlSchema.parse(record);
  const content = parsed.content ?? parsed.transcript ?? "";
  const transcript = parsed.transcript ?? content;
  return {
    slug: parsed.slug,
    metadata: parsed.metadata ?? {},
    content,
    transcript,
    wordCount: parsed.wordCount ?? transcript.split(/\s+/).filter(Boolean).length,
    contentHash: hashContent(raw),
  };
}

function parseTopicJsonlRecord(record: unknown, raw: string): Topic {
  const parsed = TopicJsonlSchema.parse(record);
  const content = parsed.content ?? "";
  const name = parsed.name ?? content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? parsed.slug;
  return {
    slug: parsed.slug,
    name,
    content,
    episodeSlugs: parsed.episodeSlugs ?? extractEpisodeSlugsFromTopic(content),
    contentHash: hashContent(raw),
  };
}

export async function loadEpisodes(episodesDir: string): Promise<Episode[]> {
  const episodes = await loadMarkdownEpisodes(episodesDir);
  const jsonlPath = path.join(path.dirname(episodesDir), "episodes.jsonl");
  const jsonlEpisodes = await loadJsonlEpisodes(jsonlPath);
  return mergeBySlug(episodes, jsonlEpisodes, jsonlPath);
}

async function loadMarkdownEpisodes(episodesDir: string): Promise<Episode[]> {
  const entries = await fs.readdir(episodesDir, { withFileTypes: true }).catch(() => []);
  const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const episodes: Episode[] = [];
  for (const slug of slugs) {
    const filePath = path.join(episodesDir, slug, "transcript.md");
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const episode = parseTranscriptFile(slug, raw);
      episode.contentHash = hashContent(raw);
      episodes.push(episode);
    } catch (err) {
      throw new Error(
        `Failed to load episode "${slug}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return episodes;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadJsonlEpisodes(filePath: string): Promise<Episode[]> {
  if (!(await fileExists(filePath))) return [];
  const episodes: Episode[] = [];
  for await (const { raw, data } of readJsonlLines(filePath)) {
    episodes.push(parseEpisodeJsonlRecord(data, raw));
  }
  return episodes;
}

export function extractEpisodeSlugsFromTopic(content: string): string[] {
  const slugs = new Set<string>();
  EPISODE_LINK_RE.lastIndex = 0;
  for (const match of content.matchAll(EPISODE_LINK_RE)) {
    slugs.add(match[1]);
  }
  return Array.from(slugs).sort();
}

export async function loadTopics(topicsDir: string): Promise<Topic[]> {
  const topics = await loadMarkdownTopics(topicsDir);
  const jsonlPath = path.join(path.dirname(topicsDir), "topics.jsonl");
  const jsonlTopics = await loadJsonlTopics(jsonlPath);
  return mergeBySlug(topics, jsonlTopics, jsonlPath);
}

async function loadMarkdownTopics(topicsDir: string): Promise<Topic[]> {
  const entries = await fs.readdir(topicsDir, { withFileTypes: true }).catch(() => []);
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name);

  const topics: Topic[] = [];
  for (const file of files) {
    const slug = file.slice(0, -3);
    if (slug === "README" || slug === "episodes") continue;

    const filePath = path.join(topicsDir, file);
    const content = await fs.readFile(filePath, "utf-8");
    const name = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? slug;

    topics.push({
      slug,
      name,
      content,
      episodeSlugs: extractEpisodeSlugsFromTopic(content),
      contentHash: hashContent(content),
    });
  }
  return topics;
}

async function loadJsonlTopics(filePath: string): Promise<Topic[]> {
  if (!(await fileExists(filePath))) return [];
  const topics: Topic[] = [];
  for await (const { raw, data } of readJsonlLines(filePath)) {
    topics.push(parseTopicJsonlRecord(data, raw));
  }
  return topics;
}

function mergeBySlug<T extends { slug: string }>(
  markdownItems: T[],
  jsonlItems: T[],
  jsonlPath: string
): T[] {
  const map = new Map<string, T>();
  for (const item of markdownItems) {
    map.set(item.slug, item);
  }
  for (const item of jsonlItems) {
    if (map.has(item.slug)) {
      throw new Error(
        `Duplicate slug "${item.slug}" found in ${jsonlPath}; it already exists as a markdown entry.`
      );
    }
    map.set(item.slug, item);
  }
  return Array.from(map.values()).sort((a, b) => a.slug.localeCompare(b.slug));
}

export interface Corpus {
  episodes: Episode[];
  topics: Topic[];
  authorPosts: AuthorPost[];
}

export async function loadCorpus(dataDir: string): Promise<Corpus> {
  const authorPosts = await loadAllAuthorPosts(path.join(dataDir, "authors"));
  return {
    episodes: authorPostsToEpisodes(authorPosts),
    topics: [],
    authorPosts,
  };
}
