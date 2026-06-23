import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DEFAULT_SEARCH_LIMIT } from "../config/constants";
import type { DocumentService } from "../service/document-service";
import { formatCorpusStats, formatDocument, formatSearchResults } from "./formatters";
import { formatSearchCompareResult } from "./formatters.search";
import {
  CompareSearchExplainSchema,
  GetCorpusStatsSchema,
  GetDocumentSchema,
  SearchDocumentsSchema,
} from "./schemas";
import { handleToolError } from "./tool-error";

export function registerCoreTools(
  server: McpServer,
  service: DocumentService,
  maxResponseChars: number
): void {
  server.registerTool(
    "search_documents",
    {
      title: "Search documents",
      description:
        'Search across imported local documents for a keyword or phrase. Returns matching documents with context snippets. Use quotes for phrase search, e.g. "product market fit".',
      inputSchema: SearchDocumentsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await service.searchDocuments({
          query: params.query,
          limit: params.limit ?? DEFAULT_SEARCH_LIMIT,
          offset: params.offset,
          page: params.page,
          category: params.category,
          guest: params.guest,
          fromDate: params.fromDate,
          toDate: params.toDate,
          rerank: params.rerank,
          rankingMode: params.rankingMode,
          explain: params.explain,
        });
        if (result.results.length === 0) {
          return { content: [{ type: "text", text: `No results found for "${params.query}".` }] };
        }
        return {
          content: [
            {
              type: "text",
              text: formatSearchResults(
                params.query,
                result.results,
                maxResponseChars,
                result.total,
                result.offset,
                result.limit
              ),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.registerTool(
    "compare_search_explain",
    {
      title: "Compare search explanations",
      description:
        "Compare weighted field ranking against reciprocal-rank fusion and show explanation deltas.",
      inputSchema: CompareSearchExplainSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await service.compareSearchExplanations(params);
        return {
          content: [{ type: "text", text: formatSearchCompareResult(result, maxResponseChars) }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.registerTool(
    "get_document",
    {
      title: "Get document content",
      description:
        "Read a specific imported document by slug. Returns metadata, summary, or full content.",
      inputSchema: GetDocumentSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = service.getDocument({
          slug: params.slug,
          guestName: params.guestName,
          section: params.section,
        });
        return {
          content: [
            {
              type: "text",
              text: formatDocument(result.slug, result.section, result.content, maxResponseChars),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.registerTool(
    "get_corpus_stats",
    {
      title: "Get corpus statistics",
      description: "Return document count, category count, index status, and generated timestamp.",
      inputSchema: GetCorpusStatsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        return { content: [{ type: "text", text: formatCorpusStats(service.getStats()) }] };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
