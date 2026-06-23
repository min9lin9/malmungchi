import { Document } from "flexsearch";
import type { DocumentRecord, SearchInput, SearchResult } from "../domain/document";
import { FIELD_WEIGHTS, FlexSearchRanker, type SemanticReranker } from "./flexsearch-ranker";
import {
  computeCorpusHash,
  computeEngineConfigHash,
  getCachePaths,
  importIndexCache,
  loadIndexCache,
  saveIndexCache,
} from "./index-cache";
import type { SearchEngine, SearchEngineBuildOptions, SearchEngineStats } from "./search-engine";

interface SearchDocument {
  slug: string;
  title: string;
  guest: string;
  transcript: string;
  keywords: string;
  publishDate: string;
  categorySlugs: string;
}

const ENGINE_CONFIG = {
  tokenize: "forward" as const,
  weights: FIELD_WEIGHTS,
};

export interface FlexSearchEngineConfig {
  maxResults: number;
  dataDir?: string;
  cacheFileName?: string;
  reranker?: SemanticReranker;
  rerankTimeoutMs?: number;
}

export class FlexSearchEngine implements SearchEngine {
  readonly engineType = "flexsearch";
  private index?: Document<unknown, boolean>;
  private documents = new Map<string, DocumentRecord>();
  private documentSearchableText = new Map<string, string>();
  private documentWordSet = new Map<string, Set<string>>();
  private documentToCategories = new Map<string, string[]>();
  private maxResults: number;
  private reranker?: SemanticReranker;
  private rerankTimeoutMs: number;

  constructor(config?: FlexSearchEngineConfig) {
    this.maxResults = config?.maxResults ?? 20;
    this.reranker = config?.reranker;
    this.rerankTimeoutMs = config?.rerankTimeoutMs ?? 2000;
  }

  async build(
    documents: DocumentRecord[],
    documentToCategories: Map<string, string[]>,
    options?: SearchEngineBuildOptions
  ): Promise<void> {
    this.documents.clear();
    this.documentSearchableText.clear();
    this.documentToCategories.clear();

    this.index = new Document<SearchDocument, false>(
      {
        document: {
          id: "slug",
          index: ["title", "guest", "transcript", "keywords"],
          store: false,
        },
        tokenize: ENGINE_CONFIG.tokenize,
        optimize: true,
      },
      {} as SearchDocument
    ) as Document<unknown, boolean>;

    const paths = options?.dataDir ? getCachePaths(options.dataDir) : null;
    const engineConfigHash = computeEngineConfigHash(ENGINE_CONFIG);
    let cached = null;

    if (paths && options?.manifest) {
      const corpusHash = computeCorpusHash(options.manifest);
      cached = await loadIndexCache(paths, corpusHash, engineConfigHash);
      if (cached) {
        await importIndexCache(this.index, cached);
      }
    }

    for (const document of documents) {
      this.documents.set(document.slug, document);
      const searchableText = FlexSearchRanker.searchableText(document).toLowerCase();
      this.documentSearchableText.set(document.slug, searchableText);
      this.documentWordSet.set(
        document.slug,
        new Set(searchableText.match(/[\p{L}\p{N}]+/gu) ?? [])
      );

      const categories = documentToCategories.get(document.slug) ?? [];
      this.documentToCategories.set(document.slug, categories);

      if (cached) continue;

      this.index.add({
        slug: document.slug,
        title: document.metadata.title ?? document.slug,
        guest: document.metadata.guest ?? "",
        transcript: document.transcript,
        keywords: (document.metadata.keywords ?? []).join(" "),
        publishDate: document.metadata.publish_date ?? "",
        categorySlugs: categories.join(","),
      });
    }

    if (paths && options?.manifest && !cached) {
      const corpusHash = computeCorpusHash(options.manifest);
      await saveIndexCache(paths, this.index, corpusHash, engineConfigHash);
    }
    await this.reranker?.prepare?.(documents);
  }

  async search(input: SearchInput): Promise<SearchResult[]> {
    const { results } = await this.searchWithTotal(input);
    return results;
  }

  async searchWithTotal(input: SearchInput): Promise<{ results: SearchResult[]; total: number }> {
    if (!this.index) throw new Error("Search index not built");

    return new FlexSearchRanker(this.index, {
      documents: this.documents,
      documentSearchableText: this.documentSearchableText,
      documentWordSet: this.documentWordSet,
      documentToCategories: this.documentToCategories,
      maxResults: this.maxResults,
      reranker: this.reranker,
      rerankTimeoutMs: this.rerankTimeoutMs,
    }).searchWithTotal(input);
  }

  async addDocuments(documents: DocumentRecord[]): Promise<void> {
    if (!this.index) throw new Error("Search index not built");

    for (const document of documents) {
      this.documents.set(document.slug, document);
      const searchableText = FlexSearchRanker.searchableText(document).toLowerCase();
      this.documentSearchableText.set(document.slug, searchableText);
      this.documentWordSet.set(
        document.slug,
        new Set(searchableText.match(/[\p{L}\p{N}]+/gu) ?? [])
      );

      const categories = this.documentToCategories.get(document.slug) ?? [];

      this.index.add({
        slug: document.slug,
        title: document.metadata.title ?? document.slug,
        guest: document.metadata.guest ?? "",
        transcript: document.transcript,
        keywords: (document.metadata.keywords ?? []).join(" "),
        publishDate: document.metadata.publish_date ?? "",
        categorySlugs: categories.join(","),
      });
    }
    await this.reranker?.prepare?.(documents);
  }

  async removeDocuments(slugs: string[]): Promise<void> {
    if (!this.index) throw new Error("Search index not built");

    for (const slug of slugs) {
      this.documents.delete(slug);
      this.documentSearchableText.delete(slug);
      this.documentWordSet.delete(slug);
      this.documentToCategories.delete(slug);
      this.index.remove(slug);
    }
  }

  getStats(): SearchEngineStats {
    return { indexedCount: this.documents.size };
  }
}
