import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const CachedEmbeddingSchema = z.object({
  slug: z.string(),
  contentHash: z.string(),
  provider: z.string(),
  model: z.string(),
  dimension: z.number().int().positive(),
  embedding: z.array(z.number()),
  createdAt: z.string(),
});

export interface EmbeddingCacheKey {
  slug: string;
  contentHash: string;
  provider: string;
  model: string;
  dimension: number;
}

export interface SaveEmbeddingInput extends EmbeddingCacheKey {
  embedding: readonly number[];
}

export class EmbeddingCache {
  constructor(private readonly rootDir: string) {}

  async load(key: EmbeddingCacheKey): Promise<number[] | null> {
    try {
      const raw = await fs.readFile(this.pathFor(key.slug), "utf-8");
      const parsed = CachedEmbeddingSchema.parse(JSON.parse(raw));
      if (
        parsed.contentHash !== key.contentHash ||
        parsed.provider !== key.provider ||
        parsed.model !== key.model ||
        parsed.dimension !== key.dimension
      ) {
        return null;
      }
      return parsed.embedding;
    } catch {
      return null;
    }
  }

  async save(input: SaveEmbeddingInput): Promise<void> {
    const filePath = this.pathFor(input.slug);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      JSON.stringify(
        {
          ...input,
          embedding: [...input.embedding],
          createdAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf-8"
    );
  }

  private pathFor(slug: string): string {
    const prefix = slug.slice(0, 2) || "__";
    return path.join(this.rootDir, prefix, `${encodeURIComponent(slug)}.json`);
  }
}
