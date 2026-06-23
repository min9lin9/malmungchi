import type {
  DocumentRecord,
  MalmungchiManifest,
  SearchInput,
  SearchResult,
} from "../domain/document";

export interface SearchEngineBuildOptions {
  dataDir?: string;
  manifest?: MalmungchiManifest;
}

export interface SearchEngineStats {
  indexedCount: number;
}

export interface SearchEngine {
  readonly engineType: "flexsearch" | "meilisearch";
  build(
    documents: DocumentRecord[],
    documentToCategories: Map<string, string[]>,
    options?: SearchEngineBuildOptions
  ): Promise<void>;
  search(input: SearchInput): Promise<SearchResult[]>;
  searchWithTotal(input: SearchInput): Promise<{ results: SearchResult[]; total: number }>;
  addDocuments(documents: DocumentRecord[]): Promise<void>;
  removeDocuments(slugs: string[]): Promise<void>;
  getStats(): SearchEngineStats;
}
