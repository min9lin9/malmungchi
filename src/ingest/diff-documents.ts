import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { loadAllAuthorPosts } from "../author/storage/author-storage";
import type { MalmunchiManifest } from "../domain/document";

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export interface DocumentCollectionDiff {
  addedDocuments: string[];
  changedDocuments: string[];
  removedDocuments: string[];
  addedCategories: string[];
  changedCategories: string[];
  removedCategories: string[];
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

async function scanMarkdownDocumentHashes(documentsDir: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  try {
    const documentSlugs = await fs.readdir(documentsDir);
    for (const slug of documentSlugs) {
      const filePath = path.join(documentsDir, slug, "transcript.md");
      try {
        const content = await fs.readFile(filePath, "utf-8");
        hashes[slug] = hashContent(content);
      } catch {
        // skip directories without transcript.md
      }
    }
  } catch {
    // documentsDir may not exist
  }
  return hashes;
}

async function scanJsonlDocumentHashes(jsonlPath: string): Promise<Record<string, string>> {
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

async function scanMarkdownCategoryHashes(categoriesDir: string): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  try {
    const categoryFiles = await fs.readdir(categoriesDir);
    for (const file of categoryFiles) {
      if (!file.endsWith(".md")) continue;
      const slug = file.slice(0, -3);
      const content = await fs.readFile(path.join(categoriesDir, file), "utf-8");
      hashes[slug] = hashContent(content);
    }
  } catch {
    // categoriesDir may not exist
  }
  return hashes;
}

async function scanJsonlCategoryHashes(jsonlPath: string): Promise<Record<string, string>> {
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

export async function diffDocuments(
  manifest: MalmunchiManifest,
  dataDir: string
): Promise<DocumentCollectionDiff> {
  const documentsDir = path.join(dataDir, "documents");
  const categoriesDir = path.join(dataDir, "categories");

  const currentDocumentHashes: Record<string, string> = {
    ...(await scanMarkdownDocumentHashes(documentsDir)),
    ...(await scanJsonlDocumentHashes(path.join(dataDir, "documents.jsonl"))),
    ...(await scanAuthorPostHashes(path.join(dataDir, "authors"))),
  };

  const currentCategoryHashes: Record<string, string> = {
    ...(await scanMarkdownCategoryHashes(categoriesDir)),
    ...(await scanJsonlCategoryHashes(path.join(dataDir, "categories.jsonl"))),
  };

  const addedDocuments = Object.keys(currentDocumentHashes).filter(
    (slug) => !manifest.documentHashes[slug]
  );
  const changedDocuments = Object.keys(currentDocumentHashes).filter(
    (slug) =>
      manifest.documentHashes[slug] && manifest.documentHashes[slug] !== currentDocumentHashes[slug]
  );
  const removedDocuments = Object.keys(manifest.documentHashes).filter(
    (slug) => !currentDocumentHashes[slug]
  );

  const addedCategories = Object.keys(currentCategoryHashes).filter(
    (slug) => !manifest.categoryHashes[slug]
  );
  const changedCategories = Object.keys(currentCategoryHashes).filter(
    (slug) =>
      manifest.categoryHashes[slug] && manifest.categoryHashes[slug] !== currentCategoryHashes[slug]
  );
  const removedCategories = Object.keys(manifest.categoryHashes).filter(
    (slug) => !currentCategoryHashes[slug]
  );

  return {
    addedDocuments,
    changedDocuments,
    removedDocuments,
    addedCategories,
    changedCategories,
    removedCategories,
  };
}
