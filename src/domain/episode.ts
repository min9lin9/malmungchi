export interface EpisodeMetadata {
  guest?: string;
  title?: string;
  youtube_url?: string;
  video_id?: string;
  publish_date?: string;
  description?: string;
  duration_seconds?: number;
  duration?: string;
  view_count?: number;
  channel?: string;
  keywords?: string[];
  source?: "podcast" | "blog" | "author";
  authorId?: string;
  originalUrl?: string;
}

export interface Episode {
  slug: string;
  metadata: EpisodeMetadata;
  content: string;
  transcript: string;
  wordCount: number;
  contentHash?: string;
}

export interface Topic {
  slug: string;
  name: string;
  content: string;
  episodeSlugs: string[];
  contentHash?: string;
}

export interface SearchInput {
  query: string;
  limit?: number;
  offset?: number;
  page?: number;
  topic?: string;
  guest?: string;
  fromDate?: string;
  toDate?: string;
  rerank?: boolean;
  rankingMode?: "weighted" | "rrf";
  explain?: boolean;
}

export interface RankingSignals {
  matchedFields: string[];
  fieldScores: Record<string, number>;
  rawScore: number;
  normalizedScore: number;
  rankingMode: "weighted" | "rrf";
  normalizedFieldScores?: Record<string, number>;
  evidence?: Array<{
    field: string;
    snippet: string;
  }>;
  rerank?: {
    attempted: boolean;
    applied: boolean;
    reason?: string;
  };
}

export interface SearchResult {
  slug: string;
  title: string;
  guest: string;
  publishDate?: string;
  score: number;
  snippet: string;
  topicSlugs: string[];
  sourceType: "podcast" | "blog" | "author";
  sourceId: string;
  rankingMode: "weighted" | "rrf";
  rankingSignals?: RankingSignals;
}

export interface CorpusStats {
  name: string;
  generatedAt: string;
  episodeCount: number;
  topicCount: number;
  indexedEpisodeCount: number;
  transcriptBytes: number;
  transcriptWordCount: number;
  schemaVersion: number;
  episodeSlugs: string[];
  topicSlugs: string[];
  episodeHashes: Record<string, string>;
  topicHashes: Record<string, string>;
}

export interface CorpusManifest extends CorpusStats {}

export interface EpisodeSectionRequest {
  slug?: string;
  guestName?: string;
  section: "metadata" | "summary" | "full";
}
