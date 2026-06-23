import type { Episode } from "../domain/episode";
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
  readonly episodes: readonly Episode[];
  readonly sourceId: string;
  readonly manifestGeneratedAt?: string;
  readonly history?: SourceHistoryResult;
  readonly format?: ExportSourceInput["format"];
}): ExportSourceResult {
  const documents = buildExportDocuments({
    source: input.detail.source,
    documents: input.episodes.map((episode) => ({
      slug: episode.slug,
      title: episode.metadata.title ?? episode.slug,
      content: episode.content,
      originalUrl: episode.metadata.originalUrl,
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
