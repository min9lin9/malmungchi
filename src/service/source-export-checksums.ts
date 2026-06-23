import { sha256Hex, stableJson } from "../util/hash";
import type {
  ExportedSourceDocument,
  Source,
  SourceHistoryResult,
  SourceType,
} from "./source-types";

export function buildExportDocuments(input: {
  readonly source: Source;
  readonly documents: readonly {
    readonly slug: string;
    readonly title: string;
    readonly content: string;
    readonly originalUrl?: string;
  }[];
}): readonly ExportedSourceDocument[] {
  return [...input.documents]
    .sort((left, right) => left.slug.localeCompare(right.slug))
    .map((document) => {
      const contentBytes = Buffer.byteLength(document.content, "utf-8");
      return {
        slug: document.slug,
        title: document.title,
        content: document.content,
        sourceType: input.source.type,
        sourceId: input.source.id,
        checksum: sha256Hex(document.content),
        checksumAlgorithm: "sha256" as const,
        contentBytes,
        provenance: {
          sourceId: input.source.id,
          sourceType: input.source.type,
          slug: document.slug,
          title: document.title,
          originalUrl: document.originalUrl,
        },
      };
    });
}

export function buildExportManifest(input: {
  readonly sourceId: string;
  readonly sourceType: SourceType;
  readonly manifestGeneratedAt?: string;
  readonly exportedAt: string;
  readonly documents: readonly ExportedSourceDocument[];
  readonly history?: SourceHistoryResult;
}): {
  readonly version: 1;
  readonly exportedAt: string;
  readonly manifestGeneratedAt?: string;
  readonly sourceId: string;
  readonly sourceType: SourceType;
  readonly documentCount: number;
  readonly contentBytes: number;
  readonly checksumAlgorithm: "sha256";
  readonly documentSetChecksum: string;
  readonly historyIncluded: boolean;
  readonly historyChecksum?: string;
  readonly provenanceChecksum: string;
  readonly bundleChecksum: string;
} {
  const contentBytes = input.documents.reduce(
    (total, document) => total + document.contentBytes,
    0
  );
  const documentChecksums = input.documents.map((document) => ({
    slug: document.slug,
    checksum: document.checksum,
    contentBytes: document.contentBytes,
  }));
  const documentSetChecksum = sha256Hex(
    stableJson({
      sourceId: input.sourceId,
      documentChecksums,
      contentBytes,
    })
  );
  const provenanceChecksum = sha256Hex(
    stableJson({
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      manifestGeneratedAt: input.manifestGeneratedAt,
      documents: input.documents.map((document) => ({
        slug: document.slug,
        title: document.title,
        sourceId: document.sourceId,
        sourceType: document.sourceType,
        checksum: document.checksum,
        originalUrl: document.provenance.originalUrl,
      })),
    })
  );
  const historyChecksum = input.history
    ? sha256Hex(
        stableJson({
          events: [...input.history.events].sort(compareHistoryEvents),
          lastCompaction: input.history.lastCompaction,
        })
      )
    : undefined;
  const bundleChecksum = sha256Hex(
    stableJson({
      sourceId: input.sourceId,
      documentSetChecksum,
      historyIncluded: input.history !== undefined,
      historyChecksum,
      provenanceChecksum,
    })
  );
  return {
    version: 1,
    exportedAt: input.exportedAt,
    manifestGeneratedAt: input.manifestGeneratedAt,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    documentCount: input.documents.length,
    contentBytes,
    checksumAlgorithm: "sha256",
    documentSetChecksum,
    historyIncluded: input.history !== undefined,
    historyChecksum,
    provenanceChecksum,
    bundleChecksum,
  };
}

function compareHistoryEvents(
  left: SourceHistoryResult["events"][number],
  right: SourceHistoryResult["events"][number]
): number {
  return (
    left.at.localeCompare(right.at) ||
    left.action.localeCompare(right.action) ||
    left.documentCount - right.documentCount
  );
}
