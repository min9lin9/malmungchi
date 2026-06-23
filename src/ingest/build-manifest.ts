import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { MALMUNGCHI_SCHEMA_VERSION } from "../config/constants";
import type { MalmungchiManifest } from "../domain/document";
import { parseManifest } from "../domain/manifest";
import type { DocumentCollection } from "./load-documents";

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
  malmungchi: DocumentCollection,
  options: { name: string; dataDir: string }
): Promise<MalmungchiManifest> {
  const { documents, categories } = malmungchi;

  let contentBytes = 0;
  let contentWordCount = 0;
  for (const document of documents) {
    contentBytes += Buffer.byteLength(document.content, "utf-8");
    contentWordCount += document.wordCount;
  }

  const documentHashes: Record<string, string> = {};
  for (const document of documents) {
    if (document.slug.startsWith("blog:")) continue;
    if (document.contentHash) {
      documentHashes[document.slug] = document.contentHash;
    } else {
      const filePath = path.join(options.dataDir, "documents", document.slug, "transcript.md");
      documentHashes[document.slug] = await hashFile(filePath);
    }
  }

  const categoryHashes: Record<string, string> = {};
  for (const category of categories) {
    if (category.contentHash) {
      categoryHashes[category.slug] = category.contentHash;
    } else {
      const filePath = path.join(options.dataDir, "categories", `${category.slug}.md`);
      categoryHashes[category.slug] = await hashFile(filePath);
    }
  }

  const manifest: MalmungchiManifest = {
    name: options.name,
    generatedAt: new Date().toISOString(),
    documentCount: documents.length,
    categoryCount: categories.length,
    indexedDocumentCount: documents.length,
    contentBytes,
    contentWordCount,
    schemaVersion: MALMUNGCHI_SCHEMA_VERSION,
    documentSlugs: documents.map((e) => e.slug).sort(),
    categorySlugs: categories.map((t) => t.slug).sort(),
    documentHashes,
    categoryHashes,
  };

  return manifest;
}

export async function writeManifest(
  manifest: MalmungchiManifest,
  manifestPath: string
): Promise<void> {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

export async function readManifest(manifestPath: string): Promise<MalmungchiManifest | null> {
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
