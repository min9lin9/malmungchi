import type { Episode, SearchResult } from "../../domain/episode";
import type { SemanticReranker } from "../flexsearch-ranker";
import { cosineSimilarity } from "./cosine";
import type { EmbeddingCache } from "./embedding-cache";
import { combineRerankScores } from "./rerank-score";

export interface TextEmbeddingProvider {
  provider: string;
  model: string;
  dimension: number;
  embed(text: string): Promise<readonly number[]>;
}

export interface EmbeddingRerankerOptions {
  provider: TextEmbeddingProvider;
  cache?: EmbeddingCache;
}

interface RerankDocument {
  text: string;
  contentHash: string;
}

export class EmbeddingReranker implements SemanticReranker {
  private readonly documents = new Map<string, RerankDocument>();
  private readonly embeddings = new Map<string, readonly number[]>();

  constructor(private readonly options: EmbeddingRerankerOptions) {}

  async prepare(episodes: readonly Episode[]): Promise<void> {
    for (const episode of episodes) {
      this.documents.set(episode.slug, {
        text: [
          episode.metadata.title ?? "",
          episode.metadata.guest ?? "",
          (episode.metadata.keywords ?? []).join(" "),
          episode.transcript,
        ].join("\n"),
        contentHash: episode.contentHash ?? episode.slug,
      });
    }
    await Promise.all(episodes.map((episode) => this.loadCachedDocument(episode.slug)));
  }

  async rerank(query: string, results: readonly SearchResult[]): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.options.provider.embed(query);
      const scored = await Promise.all(
        results.map(async (result) => ({
          result,
          semanticScore: cosineSimilarity(queryEmbedding, await this.embedDocument(result.slug)),
        }))
      );
      const combined = combineRerankScores(
        scored.map((entry) => ({
          slug: entry.result.slug,
          keywordScore: entry.result.score,
          semanticScore: entry.semanticScore,
        }))
      );
      const bySlug = new Map(scored.map((entry) => [entry.result.slug, entry.result]));
      return combined.map((entry) => ({
        ...(bySlug.get(entry.slug) ?? results[0]),
        score: entry.score,
      }));
    } catch {
      return [...results];
    }
  }

  private async embedDocument(slug: string): Promise<readonly number[]> {
    const document = this.documents.get(slug);
    if (!document) throw new Error(`Missing rerank document for ${slug}`);
    const key = {
      slug,
      contentHash: document.contentHash,
      provider: this.options.provider.provider,
      model: this.options.provider.model,
      dimension: this.options.provider.dimension,
    };
    const memoryCacheKey = this.memoryCacheKey(key);
    const memoryCached = this.embeddings.get(memoryCacheKey);
    if (memoryCached) return memoryCached;
    const cached = await this.options.cache?.load(key);
    if (cached) {
      this.embeddings.set(memoryCacheKey, cached);
      return cached;
    }

    const embedding = await this.options.provider.embed(document.text);
    await this.options.cache?.save({ ...key, embedding });
    this.embeddings.set(memoryCacheKey, embedding);
    return embedding;
  }

  private async loadCachedDocument(slug: string): Promise<void> {
    const document = this.documents.get(slug);
    if (!document || !this.options.cache) return;
    const cached = await this.options.cache.load({
      slug,
      contentHash: document.contentHash,
      provider: this.options.provider.provider,
      model: this.options.provider.model,
      dimension: this.options.provider.dimension,
    });
    if (cached) {
      this.embeddings.set(
        this.memoryCacheKey({
          slug,
          contentHash: document.contentHash,
          provider: this.options.provider.provider,
          model: this.options.provider.model,
          dimension: this.options.provider.dimension,
        }),
        cached
      );
    }
  }

  private memoryCacheKey(input: {
    slug: string;
    contentHash: string;
    provider: string;
    model: string;
    dimension: number;
  }): string {
    return [
      input.slug,
      input.contentHash,
      input.provider,
      input.model,
      String(input.dimension),
    ].join("\0");
  }
}
