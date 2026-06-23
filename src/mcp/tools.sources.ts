import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentService } from "../service/document-service";
import { formatImportAuthorResult, formatLlmStatus } from "./formatters";
import {
  formatCompactSourceMemoryResult,
  formatDeleteSourceResult,
  formatExportSourceResult,
  formatRefreshSourceResult,
  formatSourceDetail,
  formatSourceHistory,
  formatSourceStatus,
  formatSources,
} from "./formatters.sources";
import {
  CompactSourceMemorySchema,
  CorpusImportAuthorSchema,
  DeleteSourceSchema,
  ExportSourceSchema,
  GetLlmStatusSchema,
  GetSourceHistorySchema,
  GetSourceSchema,
  GetSourceStatusSchema,
  ListSourcesSchema,
  RefreshSourceSchema,
} from "./schemas";
import { handleToolError } from "./tool-error";

export function registerSourceTools(
  server: McpServer,
  service: DocumentService,
  maxResponseChars = 12000
): void {
  server.registerTool(
    "list_sources",
    {
      title: "List corpus sources",
      description: "List imported document sources currently loaded in Malmunchi.",
      inputSchema: ListSourcesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        return { content: [{ type: "text", text: formatSources(await service.listSources()) }] };
      } catch (error) {
        if (error instanceof Error) return handleToolError(error);
        throw error;
      }
    }
  );

  server.registerTool(
    "get_source",
    {
      title: "Inspect a corpus source",
      description: "Inspect one source and list the documents it contributes.",
      inputSchema: GetSourceSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const detail = await service.getSource(params.sourceId);
        return { content: [{ type: "text", text: formatSourceDetail(detail) }] };
      } catch (error) {
        if (error instanceof Error) return handleToolError(error);
        throw error;
      }
    }
  );

  server.registerTool(
    "get_llm_status",
    {
      title: "Get LLM status",
      description: "Return embedding provider, model, authentication, and diagnostic status.",
      inputSchema: GetLlmStatusSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        return { content: [{ type: "text", text: formatLlmStatus(service.getLlmStatus()) }] };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.registerTool(
    "import_author_source",
    {
      title: "Import an author source",
      description:
        "Import a server-local or inline Markdown/JSONL source as author documents and add them to search.",
      inputSchema: CorpusImportAuthorSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await service.importAuthor({
          filePath: params.filePath,
          fileContent: params.fileContent,
          fileName: params.fileName,
          authorId: params.authorId,
          splitBy: params.splitBy,
          tocKey: params.tocKey,
        });
        return { content: [{ type: "text", text: formatImportAuthorResult(result) }] };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.registerTool(
    "refresh_source",
    {
      title: "Refresh a mutable corpus source",
      description: "Re-import a stored author source and update search/manifest state.",
      inputSchema: RefreshSourceSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await service.refreshSource({
          sourceId: params.sourceId,
          dryRun: params.dryRun,
        });
        return { content: [{ type: "text", text: formatRefreshSourceResult(result) }] };
      } catch (error) {
        if (error instanceof Error) return handleToolError(error);
        throw error;
      }
    }
  );

  server.registerTool(
    "compact_source_memory",
    {
      title: "Compact source memory",
      description: "Compact JSONL source lifecycle memory for one source and retain a backup.",
      inputSchema: CompactSourceMemorySchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await service.compactSourceMemory(params.sourceId);
        return { content: [{ type: "text", text: formatCompactSourceMemoryResult(result) }] };
      } catch (error) {
        if (error instanceof Error) return handleToolError(error);
        throw error;
      }
    }
  );

  server.registerTool(
    "get_source_status",
    {
      title: "Read source status",
      description: "Read active document count and source-memory health for a corpus source.",
      inputSchema: GetSourceStatusSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await service.getSourceStatus(params.sourceId);
        return { content: [{ type: "text", text: formatSourceStatus(result) }] };
      } catch (error) {
        if (error instanceof Error) return handleToolError(error);
        throw error;
      }
    }
  );

  server.registerTool(
    "export_source",
    {
      title: "Export a corpus source",
      description: "Export source metadata and document content from the loaded corpus.",
      inputSchema: ExportSourceSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await service.exportSource(params);
        return {
          content: [{ type: "text", text: formatExportSourceResult(result, maxResponseChars) }],
        };
      } catch (error) {
        if (error instanceof Error) return handleToolError(error);
        throw error;
      }
    }
  );

  server.registerTool(
    "get_source_history",
    {
      title: "Read source history",
      description: "Read import, refresh, and delete events recorded for a corpus source.",
      inputSchema: GetSourceHistorySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await service.getSourceHistory(params);
        return { content: [{ type: "text", text: formatSourceHistory(result) }] };
      } catch (error) {
        if (error instanceof Error) return handleToolError(error);
        throw error;
      }
    }
  );

  server.registerTool(
    "delete_source",
    {
      title: "Delete a mutable corpus source",
      description: "Delete an imported author source from storage, manifest, and search.",
      inputSchema: DeleteSourceSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        const result = await service.deleteSource(params.sourceId);
        return { content: [{ type: "text", text: formatDeleteSourceResult(result) }] };
      } catch (error) {
        if (error instanceof Error) return handleToolError(error);
        throw error;
      }
    }
  );
}
