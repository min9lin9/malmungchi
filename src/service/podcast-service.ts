import type { Env } from "../config/env";
import type { CorpusStats, Episode, EpisodeSectionRequest, SearchInput } from "../domain/episode";
import { EpisodeNotFoundError, InvalidInputError } from "../domain/errors";
import { getLlmStatus, type LlmStatus } from "../llm/llm-status";
import type { SearchEngine } from "../search/search-engine";
import {
  AuthorOperations,
  type ImportAuthorInput,
  type ImportAuthorResult,
} from "./author-operations";
import type { CorpusStore } from "./corpus-store";
import { ImportMutations } from "./import-mutations";
import {
  compareSearchExplanations,
  type SearchExplainCompareInput,
  type SearchExplainCompareResult,
  type SearchTranscriptResult,
  searchTranscriptsWithTiming,
} from "./podcast-search";
import type { ReadinessStatus } from "./readiness-status";
import {
  type CompactSourceMemoryResult,
  type CorpusSource,
  type DeleteSourceResult,
  type ExportSourceInput,
  type ExportSourceResult,
  type RefreshSourceInput,
  type RefreshSourceResult,
  type SourceDetail,
  type SourceHistoryInput,
  type SourceHistoryResult,
  SourceOperations,
  type SourceStatusResult,
} from "./source-operations";

export type { ImportAuthorInput, ImportAuthorResult } from "./author-operations";

export class PodcastService {
  private readonly importMutations: ImportMutations;
  private readonly authorOperations: AuthorOperations;
  private readonly sourceOperations: SourceOperations;

  constructor(
    private readonly store: CorpusStore,
    private readonly searchEngine: SearchEngine,
    private readonly env?: Env
  ) {
    this.importMutations = new ImportMutations(store, searchEngine, env?.manifestPath);
    this.authorOperations = new AuthorOperations(this.importMutations, env);
    this.sourceOperations = new SourceOperations(store, this.importMutations, env);
  }

  async startSubscriptions(): Promise<void> {}

  stopSubscriptions(): void {}

  getStats(): CorpusStats {
    return { ...this.store.manifest };
  }

  getReadiness(): ReadinessStatus {
    const { episodeCount, topicCount, indexedEpisodeCount } = this.store.manifest;
    const corpusLoaded = episodeCount > 0;
    const searchIndexLoaded = indexedEpisodeCount > 0;

    return {
      ready: corpusLoaded && searchIndexLoaded,
      checks: {
        corpusLoaded,
        searchIndexLoaded,
      },
      stats: {
        episodeCount,
        topicCount,
        indexedEpisodeCount,
      },
    };
  }

  async searchDocuments(input: SearchInput): Promise<SearchTranscriptResult> {
    return searchTranscriptsWithTiming(this.searchEngine, input);
  }

  async searchTranscripts(input: SearchInput): Promise<SearchTranscriptResult> {
    return this.searchDocuments(input);
  }

  async compareSearchExplanations(
    input: SearchExplainCompareInput
  ): Promise<SearchExplainCompareResult> {
    return compareSearchExplanations(this.searchEngine, input);
  }

  getEpisode(input: EpisodeSectionRequest): {
    slug: string;
    section: string;
    content: string;
  } {
    const slug = this.resolveEpisodeSlug(input);
    const episode = this.store.getEpisode(slug);
    if (!episode) {
      throw new EpisodeNotFoundError(input.slug ?? input.guestName ?? "unknown");
    }

    let content: string;
    switch (input.section) {
      case "metadata":
        content = this.getMetadataSection(episode);
        break;
      case "summary":
        content = this.getSummarySection(episode);
        break;
      case "full":
        content = episode.content;
        break;
      default:
        throw new InvalidInputError(`Unknown section: ${input.section}`);
    }

    return { slug, section: input.section, content };
  }

  findEpisodeByGuestName(guestName: string): Episode | undefined {
    const normalized = guestName.toLowerCase();
    for (const episode of this.store.allEpisodes) {
      if (episode.metadata.guest?.toLowerCase().includes(normalized)) {
        return episode;
      }
      if (episode.slug.includes(normalized.replace(/\s+/g, "-"))) {
        return episode;
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

  async listSources(): Promise<CorpusSource[]> {
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

  private resolveEpisodeSlug(input: EpisodeSectionRequest): string {
    if (input.slug) return input.slug;
    if (input.guestName) {
      const episode = this.findEpisodeByGuestName(input.guestName);
      if (episode) return episode.slug;
    }
    throw new EpisodeNotFoundError(input.slug ?? input.guestName ?? "unknown");
  }

  private getMetadataSection(episode: Episode): string {
    const lines = episode.content.split("\n");
    const transcriptHeader = lines.findIndex((l) => l.trim().startsWith("## Transcript"));
    if (transcriptHeader >= 0) {
      return lines.slice(0, transcriptHeader).join("\n").trim();
    }
    return lines.slice(0, 50).join("\n");
  }

  private getSummarySection(episode: Episode): string {
    const lines = episode.content.split("\n");
    return lines.slice(0, 200).join("\n");
  }
}
