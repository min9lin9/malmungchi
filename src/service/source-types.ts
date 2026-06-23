import type { DocumentRecord } from "../domain/document";
import type { SourceMemoryEvent, SourceMemorySummary } from "../source/source-memory";
import type { ImportMutationResult } from "./import-mutations";

export type SourceType = "author";

export interface CorpusSource {
  readonly id: string;
  readonly type: SourceType;
  readonly label: string;
  readonly documentCount: number;
  readonly lastAction?: SourceMemorySummary["lastAction"];
  readonly lastSeenAt?: string;
  readonly interactionCount: number;
}

export interface SourceDocument {
  readonly slug: string;
  readonly title: string;
}

export interface ExportedSourceDocument extends SourceDocument {
  readonly content: string;
  readonly sourceType: SourceType;
  readonly sourceId: string;
  readonly checksum: string;
  readonly checksumAlgorithm: "sha256";
  readonly contentBytes: number;
  readonly provenance: SourceDocumentProvenance;
}

export interface SourceDocumentProvenance {
  readonly sourceId: string;
  readonly sourceType: SourceType;
  readonly slug: string;
  readonly title: string;
  readonly originalUrl?: string;
}

export interface SourceDetail {
  readonly source: CorpusSource;
  readonly documents: readonly SourceDocument[];
}

export interface DeleteSourceResult {
  readonly sourceId: string;
  readonly deletedDocuments: number;
}

export interface RefreshSourceInput {
  readonly sourceId: string;
  readonly dryRun?: boolean;
}

export interface RefreshSourceFailure {
  readonly stage: "load-source";
  readonly sourceId: string;
  readonly reason?: "missing-storage" | "unreadable" | "parse-error";
  readonly message: string;
}

export interface RefreshSourceResult extends ImportMutationResult {
  readonly sourceId: string;
  readonly refreshedDocuments: number;
  readonly status: "changed" | "unchanged" | "failed";
  readonly changedDocuments?: number;
  readonly dryRun?: boolean;
  readonly failures: readonly RefreshSourceFailure[];
}

export interface SourceHistoryInput {
  readonly sourceId: string;
  readonly offset?: number;
  readonly limit?: number;
}

export interface SourceHistoryResult {
  readonly sourceId: string;
  readonly events: readonly SourceMemoryEvent[];
  readonly total?: number;
  readonly offset: number;
  readonly limit: number;
  readonly malformedEventCount?: number;
  readonly totalEvents?: number;
  readonly skippedMalformedEvents?: number;
  readonly lastCompaction?: SourceMemoryCompactionRecord;
}

export interface ExportSourceInput {
  readonly sourceId: string;
  readonly format?: "json" | "markdown";
  readonly includeHistory?: boolean;
}

export interface ExportSourceResult {
  readonly source: CorpusSource;
  readonly manifest: {
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
  };
  readonly documents: readonly ExportedSourceDocument[];
  readonly format?: "json" | "markdown";
  readonly markdown?: string;
  readonly history?: SourceHistoryResult;
}

export interface SourceStatusResult {
  readonly sourceId: string;
  readonly exists: boolean;
  readonly activeDocumentCount: number;
  readonly memory: {
    readonly eventCount: number;
    readonly malformedEventCount: number;
    readonly firstSeenAt?: string;
    readonly lastSeenAt?: string;
    readonly lastAction?: SourceMemoryEvent["action"];
    readonly compacted: boolean;
    readonly lastCompactedAt?: string;
    readonly retentionKeptEvents?: number;
    readonly skippedMalformedEvents?: number;
    readonly backupRetained?: boolean;
  };
}

export interface SourceMemoryCompactionRecord {
  readonly sourceId: string;
  readonly compactedAt: string;
  readonly retainedEvents: number;
  readonly removedEvents: number;
  readonly skippedMalformedEvents: number;
  readonly backupId: string;
  readonly backupRetained: boolean;
}

export interface CompactSourceMemoryResult extends SourceMemoryCompactionRecord {
  readonly compacted: true;
}

export function getSourceId(document: DocumentRecord): string {
  if (document.metadata.source === "author") {
    return `author:${document.metadata.authorId ?? document.slug.split(":")[1] ?? "unknown"}`;
  }
  return `author:${document.metadata.authorId ?? document.slug.split(":")[1] ?? "unknown"}`;
}

export function getSourceType(sourceId: string): SourceType {
  if (sourceId.startsWith("author:")) return "author";
  throw new Error(`Unsupported source type: ${sourceId}`);
}
