import { Meilisearch } from "meilisearch";
import type { Episode, SearchInput, SearchResult } from "../domain/episode";
import type { SearchEngine, SearchEngineBuildOptions, SearchEngineStats } from "./search-engine";

export interface MeilisearchEngineConfig {
  host: string;
  apiKey?: string;
  indexName: string;
}

interface SearchableDocument {
  slug: string;
  title: string;
  guest: string;
  keywords: string;
  transcript: string;
  publishDate: string;
  topicSlugs: string;
}

const SNIPPET_WINDOW = 160;
const MARK_OPEN = "<mark>";
const MARK_CLOSE = "</mark>";

function extractSnippet(formattedTranscript: string): string {
  const markIndex = formattedTranscript.indexOf(MARK_OPEN);
  if (markIndex === -1) {
    return formattedTranscript.slice(0, SNIPPET_WINDOW).trim();
  }

  const start = Math.max(0, markIndex - SNIPPET_WINDOW / 2);
  const end = Math.min(
    formattedTranscript.length,
    markIndex + SNIPPET_WINDOW / 2 + MARK_OPEN.length + 50
  );
  return formattedTranscript.slice(start, end).trim();
}

async function waitTask(
  taskPromise: Promise<{ taskUid: number }> & {
    waitTask?: (waitOptions?: { timeout?: number; interval?: number }) => Promise<unknown>;
  }
): Promise<void> {
  // In meilisearch-js >=0.58, addDocuments/deleteDocuments return a promise-like
  // object with .waitTask(). Resolving the promise is enough for enqueue
  // confirmation; waitTask() polls until processing finishes.
  const task = await taskPromise;
  if (taskPromise.waitTask) {
    await taskPromise.waitTask();
    return;
  }
  // Fallback: busy-wait with short delay (should not happen with real client)
  await new Promise((resolve) => setTimeout(resolve, 50));
  void task;
}

export class MeilisearchEngine implements SearchEngine {
  readonly engineType = "meilisearch";
  private client: Meilisearch;
  private indexName: string;
  private episodeToTopics = new Map<string, string[]>();
  private indexedCount = 0;

  constructor(config: MeilisearchEngineConfig) {
    this.client = new Meilisearch({
      host: config.host,
      apiKey: config.apiKey,
    });
    this.indexName = config.indexName;
  }

  private get index() {
    return this.client.index(this.indexName);
  }

  async build(
    episodes: Episode[],
    episodeToTopics: Map<string, string[]>,
    _options?: SearchEngineBuildOptions
  ): Promise<void> {
    this.episodeToTopics = new Map(episodeToTopics);

    try {
      await this.client.createIndex(this.indexName, { primaryKey: "slug" });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
    }

    await this.index.updateSettings({
      searchableAttributes: ["title", "guest", "keywords", "transcript"],
      displayedAttributes: ["*"],
      rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
    });

    const docs: SearchableDocument[] = episodes.map((episode) =>
      this.toDocument(episode, episodeToTopics.get(episode.slug) ?? [])
    );

    if (docs.length > 0) {
      await waitTask(this.index.addDocuments(docs));
    }
    this.indexedCount = episodes.length;
  }

  async search(input: SearchInput): Promise<SearchResult[]> {
    const { results } = await this.searchWithTotal(input);
    return results;
  }

  async searchWithTotal(input: SearchInput): Promise<{ results: SearchResult[]; total: number }> {
    const { offset, limit } = this.resolvePagination(input);

    const response = await this.index.search(input.query, {
      limit,
      offset,
      attributesToHighlight: ["transcript"],
      highlightPreTag: MARK_OPEN,
      highlightPostTag: MARK_CLOSE,
      attributesToRetrieve: ["slug", "title", "guest", "publishDate", "topicSlugs"],
      showRankingScore: true,
    });

    const hits = response.hits as Array<{
      slug: string;
      title: string;
      guest: string;
      publishDate?: string;
      topicSlugs?: string;
      _formatted?: { transcript?: string };
      _rankingScore?: number;
    }>;

    const results: SearchResult[] = hits.map((hit) => ({
      slug: hit.slug,
      title: hit.title,
      guest: hit.guest,
      publishDate: hit.publishDate,
      score: hit._rankingScore ?? 0,
      snippet: extractSnippet(hit._formatted?.transcript ?? ""),
      topicSlugs: this.episodeToTopics.get(hit.slug) ?? [],
      sourceType: hit.slug.startsWith("blog:") ? "blog" : "podcast",
      sourceId: hit.slug.startsWith("blog:")
        ? `blog:${hit.slug.split(":")[1] ?? "unknown"}`
        : "podcast",
      rankingMode: input.rankingMode ?? "weighted",
      rankingSignals: this.toRankingSignals(
        input.explain === true,
        input.rankingMode ?? "weighted",
        hit
      ),
    }));

    const total =
      (response as { estimatedTotalHits?: number }).estimatedTotalHits ??
      (response as { totalHits?: number }).totalHits ??
      results.length;

    return { results, total };
  }

  async addDocuments(episodes: Episode[]): Promise<void> {
    const docs = episodes.map((episode) =>
      this.toDocument(episode, this.episodeToTopics.get(episode.slug) ?? [])
    );
    if (docs.length === 0) return;
    await waitTask(this.index.addDocuments(docs));
    for (const episode of episodes) {
      this.episodeToTopics.set(episode.slug, this.episodeToTopics.get(episode.slug) ?? []);
    }
    this.indexedCount += episodes.length;
  }

  async removeDocuments(slugs: string[]): Promise<void> {
    if (slugs.length === 0) return;
    await waitTask(this.index.deleteDocuments(slugs));
    this.indexedCount = Math.max(0, this.indexedCount - slugs.length);
    for (const slug of slugs) {
      this.episodeToTopics.delete(slug);
    }
  }

  getStats(): SearchEngineStats {
    return { indexedCount: this.indexedCount };
  }

  private toDocument(episode: Episode, topics: string[]): SearchableDocument {
    return {
      slug: episode.slug,
      title: episode.metadata.title ?? episode.slug,
      guest: episode.metadata.guest ?? "",
      keywords: (episode.metadata.keywords ?? []).join(" "),
      transcript: episode.transcript,
      publishDate: episode.metadata.publish_date ?? "",
      topicSlugs: topics.join(","),
    };
  }

  private toRankingSignals(
    explain: boolean,
    rankingMode: "weighted" | "rrf",
    hit: {
      _formatted?: { transcript?: string };
      _rankingScore?: number;
    }
  ): SearchResult["rankingSignals"] {
    if (!explain || hit._rankingScore === undefined) return undefined;
    const snippet = extractSnippet(hit._formatted?.transcript ?? "");
    return {
      matchedFields: ["meilisearch"],
      fieldScores: { meilisearch: hit._rankingScore },
      rawScore: hit._rankingScore,
      normalizedScore: hit._rankingScore,
      rankingMode,
      normalizedFieldScores: { meilisearch: 1 },
      evidence: snippet ? [{ field: "transcript", snippet }] : [],
      rerank: { attempted: false, applied: false, reason: "engine-managed" },
    };
  }

  private resolvePagination(input: SearchInput): {
    offset: number;
    limit: number;
  } {
    const limit = Math.max(1, Math.min(50, input.limit ?? 10));
    let offset = input.offset ?? 0;
    if (input.page && input.page > 0) {
      offset = (input.page - 1) * limit;
    }
    offset = Math.max(0, offset);
    return { offset, limit };
  }
}
