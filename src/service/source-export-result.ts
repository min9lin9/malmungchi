import type { DocumentRecord } from "../domain/document";
import { formatSourceMarkdown } from "./source-export";
import { buildExportDocuments, buildExportManifest } from "./source-export-checksums";
import type {
  ExportSourceInput,
  ExportSourceResult,
  SourceDetail,
  SourceHistoryResult,
} from "./source-types";

export function buildSourceExportResult(input: {
  readonly detail: SourceDetail;
  readonly documents: readonly DocumentRecord[];
  readonly sourceId: string;
  readonly manifestGeneratedAt?: string;
  readonly history?: SourceHistoryResult;
  readonly format?: ExportSourceInput["format"];
}): ExportSourceResult {
  const documents = buildExportDocuments({
    source: input.detail.source,
    documents: input.documents.map((document) => ({
      slug: document.slug,
      title: document.metadata.title ?? document.slug,
      content: document.content,
      originalUrl: document.metadata.originalUrl,
    })),
  });
  const manifest = buildExportManifest({
    sourceId: input.sourceId,
    sourceType: input.detail.source.type,
    manifestGeneratedAt: input.manifestGeneratedAt,
    exportedAt: new Date().toISOString(),
    documents,
    history: input.history,
  });
  const format = input.format ?? "json";
  return {
    source: input.detail.source,
    manifest,
    documents,
    format,
    markdown:
      format === "markdown"
        ? formatSourceMarkdown(input.detail.source, documents, input.history, manifest)
        : undefined,
    history: input.history,
  };
}
