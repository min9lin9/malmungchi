import { z } from "zod";
import { DATE_REGEX, DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from "../config/constants";

export const SearchDocumentsSchema = z.object({
  query: z
    .string()
    .min(2)
    .describe(
      'Search term to find in documents. Use quotes for phrases, e.g. "product market fit"'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_SEARCH_LIMIT)
    .optional()
    .describe(`Maximum number of results (default: ${DEFAULT_SEARCH_LIMIT})`),
  offset: z.number().int().min(0).optional().describe("Number of results to skip"),
  page: z.number().int().min(1).optional().describe("1-based page number"),
  category: z.string().optional().describe("Filter by category slug"),
  guest: z.string().optional().describe("Legacy author-name filter"),
  fromDate: z
    .string()
    .regex(DATE_REGEX)
    .optional()
    .describe("Filter documents published on or after this date (YYYY-MM-DD)"),
  toDate: z
    .string()
    .regex(DATE_REGEX)
    .optional()
    .describe("Filter documents published on or before this date (YYYY-MM-DD)"),
  rerank: z.boolean().optional().describe("Use semantic rerank when configured (default: true)"),
  rankingMode: z
    .union([z.literal("weighted"), z.literal("rrf")])
    .optional()
    .describe("Keyword ranking strategy: weighted field score or reciprocal-rank fusion"),
  explain: z.boolean().optional().describe("Include field-level ranking signals when available"),
});

export const GetDocumentSchema = z.object({
  slug: z.string().optional().describe("Document slug, e.g. author:demo:note"),
  guestName: z.string().optional().describe("Legacy author-name lookup"),
  section: z
    .enum(["metadata", "summary", "full"])
    .default("metadata")
    .describe("Which section to return"),
});

export const GetMalmunchiStatsSchema = z.object({});
export const ListSourcesSchema = z.object({});

export const GetSourceSchema = z.object({
  sourceId: z.string().min(1).describe('Source ID, e.g. "author:demo"'),
});

export const DeleteSourceSchema = z.object({
  sourceId: z.string().min(1).describe('Mutable source ID to delete, e.g. "author:demo"'),
});

export const RefreshSourceSchema = z.object({
  sourceId: z
    .string()
    .min(1)
    .describe('Mutable source ID to refresh from stored files, e.g. "author:demo"'),
  dryRun: z
    .boolean()
    .optional()
    .describe("Compute refresh changes without mutating storage, search, manifest, or memory"),
});

export const CompactSourceMemorySchema = z.object({
  sourceId: z.string().min(1).describe('Source ID to compact, e.g. "author:demo"'),
});

export const ExportSourceSchema = z.object({
  sourceId: z.string().min(1).describe('Source ID to export, e.g. "author:demo"'),
  format: z
    .union([z.literal("json"), z.literal("markdown")])
    .optional()
    .describe("Export format. Markdown includes a bundled markdown string."),
  includeHistory: z.boolean().optional().describe("Include source memory history in the export"),
});

export const GetSourceHistorySchema = z.object({
  sourceId: z.string().min(1).describe('Source ID to inspect history for, e.g. "author:demo"'),
  offset: z.number().int().min(0).optional().describe("History events to skip"),
  limit: z.number().int().min(0).max(200).optional().describe("Maximum history events to return"),
});

export const GetSourceStatusSchema = z.object({
  sourceId: z.string().min(1).describe('Source ID to inspect status for, e.g. "author:demo"'),
});

export const ImportAuthorSchema = z
  .object({
    filePath: z.string().min(1).optional().describe("Server-local markdown or JSONL file path"),
    fileContent: z.string().min(1).optional().describe("Inline markdown or JSONL content"),
    fileName: z.string().min(1).optional().describe("Name for inline content, e.g. source.md"),
    authorId: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
      .describe("Lowercase kebab-case author ID"),
    splitBy: z.string().min(1).optional().describe("Optional markdown split regex"),
    tocKey: z.string().min(1).optional().describe("JSONL table-of-contents grouping key"),
  })
  .refine((value) => Boolean(value.filePath || value.fileContent), {
    message: "filePath or fileContent is required",
  });

export const GetLlmStatusSchema = z.object({});

export const CompareSearchExplainSchema = z.object({
  query: z.string().min(2).describe("Search query to compare with weighted and RRF ranking"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_SEARCH_LIMIT)
    .optional()
    .describe(`Maximum results to compare (default: ${DEFAULT_SEARCH_LIMIT})`),
  category: z.string().optional().describe("Filter by category slug"),
  guest: z.string().optional().describe("Legacy author-name filter"),
  fromDate: z
    .string()
    .regex(DATE_REGEX)
    .optional()
    .describe("Filter documents published on or after this date (YYYY-MM-DD)"),
  toDate: z
    .string()
    .regex(DATE_REGEX)
    .optional()
    .describe("Filter documents published on or before this date (YYYY-MM-DD)"),
});

export type SearchDocumentsInput = z.infer<typeof SearchDocumentsSchema>;
export type GetDocumentInput = z.infer<typeof GetDocumentSchema>;
export type GetMalmunchiStatsInput = z.infer<typeof GetMalmunchiStatsSchema>;
export type ExportSourceInput = z.infer<typeof ExportSourceSchema>;
export type CompactSourceMemoryInput = z.infer<typeof CompactSourceMemorySchema>;
export type GetSourceHistoryInput = z.infer<typeof GetSourceHistorySchema>;
export type GetSourceStatusInput = z.infer<typeof GetSourceStatusSchema>;
export type RefreshSourceInput = z.infer<typeof RefreshSourceSchema>;
export type ImportAuthorInput = z.infer<typeof ImportAuthorSchema>;
export type GetLlmStatusInput = z.infer<typeof GetLlmStatusSchema>;
export type CompareSearchExplainInput = z.infer<typeof CompareSearchExplainSchema>;
