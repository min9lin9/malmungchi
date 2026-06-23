import type { Env } from "../config/env";
import type { DocumentRecord } from "../domain/document";
import { InvalidInputError } from "../domain/errors";
import { SourceMemory, type SourceMemorySummary } from "../source/source-memory";
import type { DocumentStore } from "./document-store";
import type { ImportMutations } from "./import-mutations";
import { toCompactSourceMemoryResult, toPublicCompaction } from "./source-compaction-public";
import { buildSourceExportResult } from "./source-export-result";
import { removeSourceFiles } from "./source-files";
import { assertMutableSourceId, assertSourceId } from "./source-id";
import { normalizeRefreshInput, refreshMutableSource } from "./source-refresh";
import {
  type CompactSourceMemoryResult,
  type DeleteSourceResult,
  type ExportSourceInput,
  type ExportSourceResult,
  getSourceId,
  getSourceType,
  type RefreshSourceInput,
  type RefreshSourceResult,
  type Source,
  type SourceDetail,
  type SourceHistoryInput,
  type SourceHistoryResult,
  type SourceStatusResult,
} from "./source-types";

export type {
  CompactSourceMemoryResult,
  DeleteSourceResult,
  ExportSourceInput,
  ExportSourceResult,
  RefreshSourceInput,
  RefreshSourceResult,
  Source,
  SourceDetail,
  SourceHistoryInput,
  SourceHistoryResult,
  SourceStatusResult,
} from "./source-types";

export class SourceOperations {
  private readonly memory?: SourceMemory;

  constructor(
    private readonly store: DocumentStore,
    private readonly importMutations: ImportMutations,
    private readonly env?: Env
  ) {
    this.memory = env ? SourceMemory.fromDataDir(env.dataDir) : undefined;
  }

  async listSources(): Promise<Source[]> {
    const memory = await this.memory?.summarize();
    const grouped = this.groupEpisodesBySource();
    return Array.from(grouped.entries())
      .map(([sourceId, documents]) => this.toSource(sourceId, documents, memory?.get(sourceId)))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async getSource(sourceId: string): Promise<SourceDetail> {
    assertSourceId(sourceId);
    const sources = await this.listSources();
    const source = sources.find((candidate) => candidate.id === sourceId);
    if (!source) throw new InvalidInputError(`Unknown source: ${sourceId}`);
    return {
      source,
      documents: this.getDocumentsForSource(sourceId).map((document) => ({
        slug: document.slug,
        title: document.metadata.title ?? document.slug,
      })),
    };
  }

  async refreshSource(input: string | RefreshSourceInput): Promise<RefreshSourceResult> {
    if (!this.env) throw new InvalidInputError("Source refresh requires a configured dataDir");
    const options = normalizeRefreshInput(input);
    const sourceId = options.sourceId;
    assertMutableSourceId(sourceId);
    const activeDocumentCount = this.getDocumentsForSource(sourceId).length;
    const result = await refreshMutableSource({
      env: this.env,
      importMutations: this.importMutations,
      sourceId,
      dryRun: options.dryRun,
    });
    const failedBecauseStorageIsMissing =
      result.status === "failed" &&
      result.failures.some((failure) => failure.reason === "missing-storage");
    if (result.refreshedDocuments === 0 && activeDocumentCount === 0) {
      if (!failedBecauseStorageIsMissing && result.status === "failed") return result;
      throw new InvalidInputError(`Unknown source: ${sourceId}`);
    }
    if (!options.dryRun && result.status !== "failed") {
      await this.memory?.record({
        sourceId,
        action: "refresh",
        documentCount: result.refreshedDocuments,
      });
    }
    return result;
  }

  async exportSource(input: string | ExportSourceInput): Promise<ExportSourceResult> {
    const options = typeof input === "string" ? { sourceId: input } : input;
    assertSourceId(options.sourceId);
    const detail = await this.getSource(options.sourceId);
    const history = options.includeHistory
      ? await this.getSourceHistory({ sourceId: options.sourceId })
      : undefined;
    return buildSourceExportResult({
      detail,
      documents: this.getDocumentsForSource(options.sourceId),
      sourceId: options.sourceId,
      manifestGeneratedAt: this.store.manifest.generatedAt,
      history,
      format: options.format,
    });
  }

  async getSourceHistory(input: string | SourceHistoryInput): Promise<SourceHistoryResult> {
    const options = typeof input === "string" ? { sourceId: input } : input;
    assertSourceId(options.sourceId);
    const offset = Math.max(0, options.offset ?? 0);
    const limit = Math.max(0, Math.min(200, options.limit ?? 100));
    const read = (await this.memory?.readEvents(options.sourceId)) ?? {
      events: [],
      totalEvents: 0,
      malformedEventCount: 0,
      skippedMalformedEvents: 0,
      offset: 0,
      limit: 200,
    };
    return {
      sourceId: options.sourceId,
      events: read.events.slice(offset, offset + limit),
      total: read.totalEvents,
      offset,
      limit,
      malformedEventCount: read.malformedEventCount,
      totalEvents: read.totalEvents,
      skippedMalformedEvents: read.malformedEventCount,
      lastCompaction: toPublicCompaction(await this.memory?.getCompaction(options.sourceId)),
    };
  }

  async getSourceStatus(sourceId: string): Promise<SourceStatusResult> {
    assertSourceId(sourceId);
    const activeDocumentCount = this.getDocumentsForSource(sourceId).length;
    const memory = (await this.memory?.getStatus(sourceId)) ?? {
      sourceId,
      eventCount: 0,
      malformedEventCount: 0,
      compacted: false,
    };
    return {
      sourceId,
      exists: activeDocumentCount > 0,
      activeDocumentCount,
      memory: {
        eventCount: memory.eventCount,
        malformedEventCount: memory.malformedEventCount,
        firstSeenAt: memory.firstSeenAt,
        lastSeenAt: memory.lastSeenAt,
        lastAction: memory.lastAction,
        compacted: memory.compacted,
        lastCompactedAt: memory.lastCompactedAt,
        retentionKeptEvents: memory.retentionKeptEvents,
        skippedMalformedEvents: memory.skippedMalformedEvents,
        backupRetained: memory.backupRetained,
      },
    };
  }

  async compactSourceMemory(sourceId: string): Promise<CompactSourceMemoryResult> {
    if (!this.memory) throw new InvalidInputError("Source memory requires a configured dataDir");
    assertMutableSourceId(sourceId);
    const activeDocumentCount = this.getDocumentsForSource(sourceId).length;
    const memoryEventCount = (await this.memory.readEvents(sourceId)).totalEvents;
    if (activeDocumentCount === 0 && memoryEventCount === 0) {
      throw new InvalidInputError(`Unknown source: ${sourceId}`);
    }
    return toCompactSourceMemoryResult(await this.memory.compactSource(sourceId));
  }

  async deleteSource(sourceId: string): Promise<DeleteSourceResult> {
    assertMutableSourceId(sourceId);
    const documents = this.getDocumentsForSource(sourceId);
    if (documents.length === 0) throw new InvalidInputError(`Unknown source: ${sourceId}`);
    await this.importMutations.removeDocuments(documents.map((document) => document.slug));
    await removeSourceFiles(this.env, sourceId);
    await this.memory?.record({
      sourceId,
      action: "delete",
      documentCount: documents.length,
    });
    return { sourceId, deletedDocuments: documents.length };
  }

  private groupEpisodesBySource(): Map<string, DocumentRecord[]> {
    const grouped = new Map<string, DocumentRecord[]>();
    for (const document of this.store.allDocuments) {
      const sourceId = getSourceId(document);
      const documents = grouped.get(sourceId) ?? [];
      documents.push(document);
      grouped.set(sourceId, documents);
    }
    return grouped;
  }

  private getDocumentsForSource(sourceId: string): DocumentRecord[] {
    return this.store.allDocuments.filter((document) => getSourceId(document) === sourceId);
  }

  private toSource(
    sourceId: string,
    documents: readonly DocumentRecord[],
    memory?: SourceMemorySummary
  ): Source {
    return {
      id: sourceId,
      type: getSourceType(sourceId),
      label: sourceId,
      documentCount: documents.length,
      lastAction: memory?.lastAction,
      lastSeenAt: memory?.lastSeenAt,
      interactionCount: memory?.interactionCount ?? 0,
    };
  }
}
