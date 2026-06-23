import type { Env } from "../config/env";
import type {
  DocumentRecord,
  DocumentSectionRequest,
  MalmungchiStats,
  SearchInput,
} from "../domain/document";
import { DocumentNotFoundError, InvalidInputError } from "../domain/errors";
import { getLlmStatus, type LlmStatus } from "../llm/llm-status";
import type { SearchEngine } from "../search/search-engine";
import {
  AuthorOperations,
  type ImportAuthorInput,
  type ImportAuthorResult,
} from "./author-operations";
import {
  compareSearchExplanations,
  type SearchDocumentResult,
  type SearchExplainCompareInput,
  type SearchExplainCompareResult,
  searchDocumentsWithTiming,
} from "./document-search";
import type { DocumentStore } from "./document-store";
import { ImportMutations } from "./import-mutations";
import type { ReadinessStatus } from "./readiness-status";
import {
  type CompactSourceMemoryResult,
  type DeleteSourceResult,
  type ExportSourceInput,
  type ExportSourceResult,
  type RefreshSourceInput,
  type RefreshSourceResult,
  type Source,
  type SourceDetail,
  type SourceHistoryInput,
  type SourceHistoryResult,
  SourceOperations,
  type SourceStatusResult,
} from "./source-operations";

export type { ImportAuthorInput, ImportAuthorResult } from "./author-operations";

export class DocumentService {
  private readonly importMutations: ImportMutations;
  private readonly authorOperations: AuthorOperations;
  private readonly sourceOperations: SourceOperations;

  constructor(
    private readonly store: DocumentStore,
    private readonly searchEngine: SearchEngine,
    private readonly env?: Env
  ) {
    this.importMutations = new ImportMutations(store, searchEngine, env?.manifestPath);
    this.authorOperations = new AuthorOperations(this.importMutations, env);
    this.sourceOperations = new SourceOperations(store, this.importMutations, env);
  }

  async startSubscriptions(): Promise<void> {}

  stopSubscriptions(): void {}

  getStats(): MalmungchiStats {
    return { ...this.store.manifest };
  }

  getReadiness(): ReadinessStatus {
    const { documentCount, categoryCount, indexedDocumentCount } = this.store.manifest;
    const documentsLoaded = documentCount > 0;
    const searchIndexLoaded = indexedDocumentCount > 0;

    return {
      ready: documentsLoaded && searchIndexLoaded,
      checks: {
        documentsLoaded,
        searchIndexLoaded,
      },
      stats: {
        documentCount,
        categoryCount,
        indexedDocumentCount,
      },
    };
  }

  async searchDocuments(input: SearchInput): Promise<SearchDocumentResult> {
    return searchDocumentsWithTiming(this.searchEngine, input);
  }

  async compareSearchExplanations(
    input: SearchExplainCompareInput
  ): Promise<SearchExplainCompareResult> {
    return compareSearchExplanations(this.searchEngine, input);
  }

  getDocument(input: DocumentSectionRequest): {
    slug: string;
    section: string;
    content: string;
  } {
    const slug = this.resolveDocumentSlug(input);
    const document = this.store.getDocument(slug);
    if (!document) {
      throw new DocumentNotFoundError(input.slug ?? input.guestName ?? "unknown");
    }

    let content: string;
    switch (input.section) {
      case "metadata":
        content = this.getMetadataSection(document);
        break;
      case "summary":
        content = this.getSummarySection(document);
        break;
      case "full":
        content = document.content;
        break;
      default:
        throw new InvalidInputError(`Unknown section: ${input.section}`);
    }

    return { slug, section: input.section, content };
  }

  findDocumentByGuestName(guestName: string): DocumentRecord | undefined {
    const normalized = guestName.toLowerCase();
    for (const document of this.store.allDocuments) {
      if (document.metadata.guest?.toLowerCase().includes(normalized)) {
        return document;
      }
      if (document.slug.includes(normalized.replace(/\s+/g, "-"))) {
        return document;
      }
    }
    return undefined;
  }

  getLlmStatus(): LlmStatus {
    return getLlmStatus(this.env);
  }

  async importAuthor(input: ImportAuthorInput): Promise<ImportAuthorResult> {
    return this.authorOperations.importAuthor(input);
  }

  async listSources(): Promise<Source[]> {
    return this.sourceOperations.listSources();
  }

  async getSource(sourceId: string): Promise<SourceDetail> {
    return this.sourceOperations.getSource(sourceId);
  }

  async refreshSource(input: string | RefreshSourceInput): Promise<RefreshSourceResult> {
    return this.sourceOperations.refreshSource(input);
  }

  async exportSource(input: string | ExportSourceInput): Promise<ExportSourceResult> {
    return this.sourceOperations.exportSource(input);
  }

  async getSourceHistory(input: string | SourceHistoryInput): Promise<SourceHistoryResult> {
    return this.sourceOperations.getSourceHistory(input);
  }

  async getSourceStatus(sourceId: string): Promise<SourceStatusResult> {
    return this.sourceOperations.getSourceStatus(sourceId);
  }

  async compactSourceMemory(sourceId: string): Promise<CompactSourceMemoryResult> {
    return this.sourceOperations.compactSourceMemory(sourceId);
  }

  async deleteSource(sourceId: string): Promise<DeleteSourceResult> {
    return this.sourceOperations.deleteSource(sourceId);
  }

  private resolveDocumentSlug(input: DocumentSectionRequest): string {
    if (input.slug) return input.slug;
    if (input.guestName) {
      const document = this.findDocumentByGuestName(input.guestName);
      if (document) return document.slug;
    }
    throw new DocumentNotFoundError(input.slug ?? input.guestName ?? "unknown");
  }

  private getMetadataSection(document: DocumentRecord): string {
    const lines = document.content.split("\n");
    const transcriptHeader = lines.findIndex((l) => l.trim().startsWith("## Transcript"));
    if (transcriptHeader >= 0) {
      return lines.slice(0, transcriptHeader).join("\n").trim();
    }
    return lines.slice(0, 50).join("\n");
  }

  private getSummarySection(document: DocumentRecord): string {
    const lines = document.content.split("\n");
    return lines.slice(0, 200).join("\n");
  }
}
