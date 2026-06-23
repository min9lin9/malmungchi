import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { authorPostsToDocuments } from "../author/document/author-to-document";
import type { AuthorPost } from "../author/domain/author-post";
import { loadAllAuthorPosts } from "../author/storage/author-storage";
import type { Category, DocumentRecord } from "../domain/document";
import { parseTranscriptFile } from "./parse-transcript";

const DOCUMENT_LINK_RE = /\[.*?\]\(\.\.\/documents\/([^/\s)]+)\/transcript\.md\)/g;

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

const DocumentMetadataSchema = z
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
  metadata: DocumentMetadataSchema.optional(),
  content: z.string().optional(),
  transcript: z.string().optional(),
  wordCount: z.number().int().nonnegative().optional(),
});

const TopicJsonlSchema = z.object({
  slug: z.string().min(1),
  name: z.string().optional(),
  content: z.string().optional(),
  documentSlugs: z.array(z.string()).optional(),
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

function parseDocumentJsonlRecord(record: unknown, raw: string): DocumentRecord {
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

function parseCategoryJsonlRecord(record: unknown, raw: string): Category {
  const parsed = TopicJsonlSchema.parse(record);
  const content = parsed.content ?? "";
  const name = parsed.name ?? content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? parsed.slug;
  return {
    slug: parsed.slug,
    name,
    content,
    documentSlugs: parsed.documentSlugs ?? extractDocumentSlugsFromCategory(content),
    contentHash: hashContent(raw),
  };
}

export async function loadDocumentRecords(documentsDir: string): Promise<DocumentRecord[]> {
  const documents = await loadMarkdownDocuments(documentsDir);
  const jsonlPath = path.join(path.dirname(documentsDir), "documents.jsonl");
  const jsonlEpisodes = await loadJsonlDocuments(jsonlPath);
  return mergeBySlug(documents, jsonlEpisodes, jsonlPath);
}

async function loadMarkdownDocuments(documentsDir: string): Promise<DocumentRecord[]> {
  const entries = await fs.readdir(documentsDir, { withFileTypes: true }).catch(() => []);
  const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const documents: DocumentRecord[] = [];
  for (const slug of slugs) {
    const filePath = path.join(documentsDir, slug, "transcript.md");
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const document = parseTranscriptFile(slug, raw);
      document.contentHash = hashContent(raw);
      documents.push(document);
    } catch (err) {
      throw new Error(
        `Failed to load document "${slug}": ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  return documents;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadJsonlDocuments(filePath: string): Promise<DocumentRecord[]> {
  if (!(await fileExists(filePath))) return [];
  const documents: DocumentRecord[] = [];
  for await (const { raw, data } of readJsonlLines(filePath)) {
    documents.push(parseDocumentJsonlRecord(data, raw));
  }
  return documents;
}

export function extractDocumentSlugsFromCategory(content: string): string[] {
  const slugs = new Set<string>();
  DOCUMENT_LINK_RE.lastIndex = 0;
  for (const match of content.matchAll(DOCUMENT_LINK_RE)) {
    slugs.add(match[1]);
  }
  return Array.from(slugs).sort();
}

export async function loadCategories(categoriesDir: string): Promise<Category[]> {
  const categories = await loadMarkdownCategories(categoriesDir);
  const jsonlPath = path.join(path.dirname(categoriesDir), "categories.jsonl");
  const jsonlTopics = await loadJsonlCategories(jsonlPath);
  return mergeBySlug(categories, jsonlTopics, jsonlPath);
}

async function loadMarkdownCategories(categoriesDir: string): Promise<Category[]> {
  const entries = await fs.readdir(categoriesDir, { withFileTypes: true }).catch(() => []);
  const files = entries.filter((e) => e.isFile() && e.name.endsWith(".md")).map((e) => e.name);

  const categories: Category[] = [];
  for (const file of files) {
    const slug = file.slice(0, -3);
    if (slug === "README" || slug === "documents") continue;

    const filePath = path.join(categoriesDir, file);
    const content = await fs.readFile(filePath, "utf-8");
    const name = content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? slug;

    categories.push({
      slug,
      name,
      content,
      documentSlugs: extractDocumentSlugsFromCategory(content),
      contentHash: hashContent(content),
    });
  }
  return categories;
}

async function loadJsonlCategories(filePath: string): Promise<Category[]> {
  if (!(await fileExists(filePath))) return [];
  const categories: Category[] = [];
  for await (const { raw, data } of readJsonlLines(filePath)) {
    categories.push(parseCategoryJsonlRecord(data, raw));
  }
  return categories;
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

export interface DocumentCollection {
  documents: DocumentRecord[];
  categories: Category[];
  authorPosts: AuthorPost[];
}

export async function loadDocuments(dataDir: string): Promise<DocumentCollection> {
  const authorPosts = await loadAllAuthorPosts(path.join(dataDir, "authors"));
  return {
    documents: authorPostsToDocuments(authorPosts),
    categories: [],
    authorPosts,
  };
}
