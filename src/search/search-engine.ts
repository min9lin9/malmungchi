import type { CorpusManifest, Episode, SearchInput, SearchResult } from "../domain/episode";

export interface SearchEngineBuildOptions {
  dataDir?: string;
  manifest?: CorpusManifest;
}

export interface SearchEngineStats {
  indexedCount: number;
}

export interface SearchEngine {
  readonly engineType: "flexsearch" | "meilisearch";
  build(
    episodes: Episode[],
    episodeToTopics: Map<string, string[]>,
    options?: SearchEngineBuildOptions
  ): Promise<void>;
  search(input: SearchInput): Promise<SearchResult[]>;
  searchWithTotal(input: SearchInput): Promise<{ results: SearchResult[]; total: number }>;
  addDocuments(episodes: Episode[]): Promise<void>;
  removeDocuments(slugs: string[]): Promise<void>;
  getStats(): SearchEngineStats;
}
