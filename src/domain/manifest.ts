import { z } from "zod";
import type { MalmungchiManifest } from "./document";

export const MalmungchiManifestSchema = z.object({
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
}) satisfies z.ZodType<MalmungchiManifest>;

export function parseManifest(raw: unknown): MalmungchiManifest | null {
  const result = MalmungchiManifestSchema.safeParse(raw);
  if (!result.success) {
    return null;
  }
  return result.data;
}
