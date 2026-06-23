import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { type AuthorImportResult, type AuthorPost, createAuthorSlug } from "../domain/author-post";

export interface ImportAuthorFileInput {
  filePath: string;
  authorId: string;
  authorsDir: string;
  splitBy?: string;
  tocKey?: string;
}

export interface ImportAuthorTextInput {
  content: string;
  fileName: string;
  authorId: string;
  authorsDir: string;
  splitBy?: string;
  tocKey?: string;
}

const JsonlRecordSchema = z.record(z.unknown());
const DEFAULT_LLM_SPLIT_TOKEN_THRESHOLD = 8000;

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^---[\s\S]*?---\s*/u, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMarkdown(content: string, splitBy?: string): Array<{ title: string; body: string }> {
  const heading = splitBy ? new RegExp(splitBy, "gm") : /^#{1,3}\s+(.+)$/gm;
  const matches = Array.from(content.matchAll(heading));
  if (matches.length === 0) {
    return [{ title: "Untitled", body: content.trim() }];
  }

  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? content.length;
    const title = (match[1] ?? match[0]).replace(/^#{1,6}\s+/, "").trim();
    return { title, body: content.slice(start, end).trim() };
  });
}

function tokenCount(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length;
}

function splitByLLM(section: {
  title: string;
  body: string;
}): Array<{ title: string; body: string }> {
  const words = section.body.split(/\s+/u).filter(Boolean);
  if (words.length <= DEFAULT_LLM_SPLIT_TOKEN_THRESHOLD) return [section];

  const chunks: Array<{ title: string; body: string }> = [];
  for (let start = 0; start < words.length; start += DEFAULT_LLM_SPLIT_TOKEN_THRESHOLD) {
    const index = chunks.length;
    chunks.push({
      title: index === 0 ? section.title : `${section.title} ${index + 1}`,
      body: words.slice(start, start + DEFAULT_LLM_SPLIT_TOKEN_THRESHOLD).join(" "),
    });
  }
  return chunks;
}

function splitOversizedSections(
  sections: Array<{ title: string; body: string }>
): Array<{ title: string; body: string }> {
  return sections.flatMap((section) =>
    tokenCount(section.body) > DEFAULT_LLM_SPLIT_TOKEN_THRESHOLD ? splitByLLM(section) : [section]
  );
}

function disambiguateDuplicateTitles(
  sections: Array<{ title: string; body: string }>
): Array<{ title: string; body: string }> {
  const counts = new Map<string, number>();
  return sections.map((section) => {
    const key = slugify(section.title);
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);
    return count === 1 ? section : { ...section, title: `${section.title} ${count}` };
  });
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function parseJsonl(content: string, tocKey: string): Array<{ title: string; body: string }> {
  const grouped = new Map<string, string[]>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const record = JsonlRecordSchema.parse(JSON.parse(trimmed));
    const tocValue = stringField(record, tocKey);
    if (!tocValue) throw new Error(`JSONL import requires tocKey "${tocKey}" in every record`);
    const text = stringField(record, "content") ?? stringField(record, "text") ?? "";
    grouped.set(tocValue, [...(grouped.get(tocValue) ?? []), text]);
  }
  return Array.from(grouped.entries()).map(([title, parts]) => ({
    title,
    body: [`# ${title}`, "", ...parts].join("\n").trim(),
  }));
}

function postFromSection(input: {
  authorId: string;
  title: string;
  body: string;
  source: string;
}): AuthorPost {
  const documentSlug = slugify(input.title);
  const contentMarkdown = input.body;
  return {
    authorId: input.authorId,
    documentSlug,
    slug: createAuthorSlug(input.authorId, documentSlug),
    title: input.title,
    sourceUrl: input.source,
    publishedAt: null,
    contentText: stripMarkdown(contentMarkdown),
    contentMarkdown,
    contentHash: hashContent(`${input.authorId}\n${input.title}\n${contentMarkdown}`),
  };
}

export async function saveAuthorPosts(posts: AuthorPost[], authorsDir: string): Promise<void> {
  for (const post of posts) {
    const postDir = path.join(authorsDir, post.authorId, "posts", post.documentSlug);
    await fs.mkdir(postDir, { recursive: true });
    const frontmatter = {
      author_id: post.authorId,
      document_slug: post.documentSlug,
      slug: post.slug,
      title: post.title,
      source_url: post.sourceUrl,
      published_at: post.publishedAt,
      content_hash: post.contentHash,
    };
    await fs.writeFile(
      path.join(postDir, "post.md"),
      `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n\n${post.contentMarkdown}`,
      "utf-8"
    );
  }
}

export async function importAuthorText(input: ImportAuthorTextInput): Promise<AuthorImportResult> {
  const isJsonl = input.fileName.endsWith(".jsonl");
  if (isJsonl && !input.tocKey) throw new Error("JSONL author import requires tocKey");
  const sections = isJsonl
    ? parseJsonl(input.content, input.tocKey ?? "")
    : splitMarkdown(input.content, input.splitBy);
  const posts = disambiguateDuplicateTitles(splitOversizedSections(sections)).map((section) =>
    postFromSection({
      authorId: input.authorId,
      title: section.title,
      body: section.body,
      source: input.fileName,
    })
  );
  await saveAuthorPosts(posts, input.authorsDir);
  return { authorId: input.authorId, source: input.fileName, posts };
}

export async function importAuthorFile(input: ImportAuthorFileInput): Promise<AuthorImportResult> {
  const content = await fs.readFile(input.filePath, "utf-8");
  return importAuthorText({
    content,
    fileName: input.filePath,
    authorId: input.authorId,
    authorsDir: input.authorsDir,
    splitBy: input.splitBy,
    tocKey: input.tocKey,
  });
}

export async function loadAuthorPost(filePath: string): Promise<AuthorPost | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const frontmatterEnd = raw.indexOf("\n---\n");
    if (frontmatterEnd === -1) return null;
    const metadata = JSON.parse(raw.slice(4, frontmatterEnd)) as Record<string, unknown>;
    const contentMarkdown = raw.slice(frontmatterEnd + 5).trim();
    const authorId = String(metadata.author_id ?? "");
    const documentSlug = String(metadata.document_slug ?? "");
    return {
      authorId,
      documentSlug,
      slug: String(metadata.slug ?? createAuthorSlug(authorId, documentSlug)),
      title: String(metadata.title ?? documentSlug),
      sourceUrl: String(metadata.source_url ?? ""),
      publishedAt: metadata.published_at ? String(metadata.published_at) : null,
      contentText: stripMarkdown(contentMarkdown),
      contentMarkdown,
      contentHash: String(metadata.content_hash ?? hashContent(contentMarkdown)),
    };
  } catch {
    return null;
  }
}

export async function loadAllAuthorPosts(authorsDir: string): Promise<AuthorPost[]> {
  const posts: AuthorPost[] = [];
  const authors = await fs.readdir(authorsDir, { withFileTypes: true }).catch(() => []);
  for (const author of authors) {
    if (!author.isDirectory()) continue;
    const postsDir = path.join(authorsDir, author.name, "posts");
    const entries = await fs.readdir(postsDir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const post = await loadAuthorPost(path.join(postsDir, entry.name, "post.md"));
      if (post) posts.push(post);
    }
  }
  return posts.sort((a, b) => a.slug.localeCompare(b.slug));
}
