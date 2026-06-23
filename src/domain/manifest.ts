import { z } from "zod";
import type { CorpusManifest } from "./episode";

export const CorpusManifestSchema = z.object({
  name: z.string(),
  generatedAt: z.string(),
  episodeCount: z.number().int().nonnegative(),
  topicCount: z.number().int().nonnegative(),
  indexedEpisodeCount: z.number().int().nonnegative(),
  transcriptBytes: z.number().int().nonnegative(),
  transcriptWordCount: z.number().int().nonnegative(),
  schemaVersion: z.number().int().nonnegative(),
  episodeSlugs: z.array(z.string()),
  topicSlugs: z.array(z.string()),
  episodeHashes: z.record(z.string()),
  topicHashes: z.record(z.string()),
}) satisfies z.ZodType<CorpusManifest>;

export function parseManifest(raw: unknown): CorpusManifest | null {
  const result = CorpusManifestSchema.safeParse(raw);
  if (!result.success) {
    return null;
  }
  return result.data;
}
