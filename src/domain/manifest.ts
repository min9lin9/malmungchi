import { z } from "zod";
import type { CorpusManifest } from "./document";

export const CorpusManifestSchema = z.object({
  name: z.string(),
  generatedAt: z.string(),
  documentCount: z.number().int().nonnegative(),
  categoryCount: z.number().int().nonnegative(),
  indexedDocumentCount: z.number().int().nonnegative(),
  contentBytes: z.number().int().nonnegative(),
  contentWordCount: z.number().int().nonnegative(),
  schemaVersion: z.number().int().nonnegative(),
  documentSlugs: z.array(z.string()),
  categorySlugs: z.array(z.string()),
  documentHashes: z.record(z.string()),
  categoryHashes: z.record(z.string()),
}) satisfies z.ZodType<CorpusManifest>;

export function parseManifest(raw: unknown): CorpusManifest | null {
  const result = CorpusManifestSchema.safeParse(raw);
  if (!result.success) {
    return null;
  }
  return result.data;
}
