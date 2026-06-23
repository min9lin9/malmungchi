import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Document } from "flexsearch";
import { z } from "zod";
import type { CorpusManifest } from "../domain/episode";

const CACHE_SCHEMA_VERSION = 1;

export const IndexCacheSchema = z.object({
  schemaVersion: z.number(),
  corpusHash: z.string(),
  engineConfigHash: z.string(),
  indices: z.record(z.unknown()),
});

export type IndexCache = z.infer<typeof IndexCacheSchema>;

export interface CachePaths {
  cacheDir: string;
  cacheFile: string;
}

export function getCachePaths(dataDir: string): CachePaths {
  const cacheDir = path.join(dataDir, ".cache");
  const cacheFile = path.join(cacheDir, "flexsearch-index.json");
  return { cacheDir, cacheFile };
}

export function computeCorpusHash(manifest: CorpusManifest): string {
  const payload = JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    episodeCount: manifest.episodeCount,
    topicCount: manifest.topicCount,
    transcriptBytes: manifest.transcriptBytes,
    episodeSlugs: manifest.episodeSlugs,
    topicSlugs: manifest.topicSlugs,
  });
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function computeEngineConfigHash(config: {
  tokenize: string;
  weights: Record<string, number>;
}): string {
  const payload = JSON.stringify(config);
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export async function loadIndexCache(
  paths: CachePaths,
  corpusHash: string,
  engineConfigHash: string
): Promise<IndexCache | null> {
  try {
    const raw = await fs.readFile(paths.cacheFile, "utf-8");
    const parsed = JSON.parse(raw);
    const cached = IndexCacheSchema.safeParse(parsed);
    if (!cached.success) {
      console.error("[index-cache] cache file schema invalid, rebuilding");
      return null;
    }

    if (
      cached.data.schemaVersion !== CACHE_SCHEMA_VERSION ||
      cached.data.corpusHash !== corpusHash ||
      cached.data.engineConfigHash !== engineConfigHash
    ) {
      return null;
    }

    return cached.data;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[index-cache] failed to load cache: ${error.message}`);
    }
    return null;
  }
}

export async function saveIndexCache(
  paths: CachePaths,
  index: Document<unknown, boolean>,
  corpusHash: string,
  engineConfigHash: string
): Promise<void> {
  const indices: Record<string, unknown> = {};
  await index.export((key, value) => {
    indices[String(key)] = value;
  });

  const cache: IndexCache = {
    schemaVersion: CACHE_SCHEMA_VERSION,
    corpusHash,
    engineConfigHash,
    indices,
  };

  await fs.mkdir(paths.cacheDir, { recursive: true });
  await fs.writeFile(paths.cacheFile, JSON.stringify(cache), "utf-8");
}

export async function importIndexCache(
  index: Document<unknown, boolean>,
  cached: IndexCache
): Promise<void> {
  for (const [key, value] of Object.entries(cached.indices)) {
    await index.import(key, value as never);
  }
}
