import { Document } from "flexsearch";
import type { Episode, SearchInput, SearchResult } from "../domain/episode";
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
  topicSlugs: string;
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
  private episodes = new Map<string, Episode>();
  private episodeSearchableText = new Map<string, string>();
  private episodeWordSet = new Map<string, Set<string>>();
  private episodeToTopics = new Map<string, string[]>();
  private maxResults: number;
  private reranker?: SemanticReranker;
  private rerankTimeoutMs: number;

  constructor(config?: FlexSearchEngineConfig) {
    this.maxResults = config?.maxResults ?? 20;
    this.reranker = config?.reranker;
    this.rerankTimeoutMs = config?.rerankTimeoutMs ?? 2000;
  }

  async build(
    episodes: Episode[],
    episodeToTopics: Map<string, string[]>,
    options?: SearchEngineBuildOptions
  ): Promise<void> {
    this.episodes.clear();
    this.episodeSearchableText.clear();
    this.episodeToTopics.clear();

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

    for (const episode of episodes) {
      this.episodes.set(episode.slug, episode);
      const searchableText = FlexSearchRanker.searchableText(episode).toLowerCase();
      this.episodeSearchableText.set(episode.slug, searchableText);
      this.episodeWordSet.set(episode.slug, new Set(searchableText.match(/[\p{L}\p{N}]+/gu) ?? []));

      const topics = episodeToTopics.get(episode.slug) ?? [];
      this.episodeToTopics.set(episode.slug, topics);

      if (cached) continue;

      this.index.add({
        slug: episode.slug,
        title: episode.metadata.title ?? episode.slug,
        guest: episode.metadata.guest ?? "",
        transcript: episode.transcript,
        keywords: (episode.metadata.keywords ?? []).join(" "),
        publishDate: episode.metadata.publish_date ?? "",
        topicSlugs: topics.join(","),
      });
    }

    if (paths && options?.manifest && !cached) {
      const corpusHash = computeCorpusHash(options.manifest);
      await saveIndexCache(paths, this.index, corpusHash, engineConfigHash);
    }
    await this.reranker?.prepare?.(episodes);
  }

  async search(input: SearchInput): Promise<SearchResult[]> {
    const { results } = await this.searchWithTotal(input);
    return results;
  }

  async searchWithTotal(input: SearchInput): Promise<{ results: SearchResult[]; total: number }> {
    if (!this.index) throw new Error("Search index not built");

    return new FlexSearchRanker(this.index, {
      episodes: this.episodes,
      episodeSearchableText: this.episodeSearchableText,
      episodeWordSet: this.episodeWordSet,
      episodeToTopics: this.episodeToTopics,
      maxResults: this.maxResults,
      reranker: this.reranker,
      rerankTimeoutMs: this.rerankTimeoutMs,
    }).searchWithTotal(input);
  }

  async addDocuments(episodes: Episode[]): Promise<void> {
    if (!this.index) throw new Error("Search index not built");

    for (const episode of episodes) {
      this.episodes.set(episode.slug, episode);
      const searchableText = FlexSearchRanker.searchableText(episode).toLowerCase();
      this.episodeSearchableText.set(episode.slug, searchableText);
      this.episodeWordSet.set(episode.slug, new Set(searchableText.match(/[\p{L}\p{N}]+/gu) ?? []));

      const topics = this.episodeToTopics.get(episode.slug) ?? [];

      this.index.add({
        slug: episode.slug,
        title: episode.metadata.title ?? episode.slug,
        guest: episode.metadata.guest ?? "",
        transcript: episode.transcript,
        keywords: (episode.metadata.keywords ?? []).join(" "),
        publishDate: episode.metadata.publish_date ?? "",
        topicSlugs: topics.join(","),
      });
    }
    await this.reranker?.prepare?.(episodes);
  }

  async removeDocuments(slugs: string[]): Promise<void> {
    if (!this.index) throw new Error("Search index not built");

    for (const slug of slugs) {
      this.episodes.delete(slug);
      this.episodeSearchableText.delete(slug);
      this.episodeWordSet.delete(slug);
      this.episodeToTopics.delete(slug);
      this.index.remove(slug);
    }
  }

  getStats(): SearchEngineStats {
    return { indexedCount: this.episodes.size };
  }
}
