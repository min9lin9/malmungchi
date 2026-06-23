export interface DocumentMetadata {
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
  source?: "author";
  authorId?: string;
  originalUrl?: string;
}

export interface DocumentRecord {
  slug: string;
  metadata: DocumentMetadata;
  content: string;
  transcript: string;
  wordCount: number;
  contentHash?: string;
}

export interface Category {
  slug: string;
  name: string;
  content: string;
  documentSlugs: string[];
  contentHash?: string;
}

export interface SearchInput {
  query: string;
  limit?: number;
  offset?: number;
  page?: number;
  category?: string;
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
  categorySlugs: string[];
  sourceType: "author";
  sourceId: string;
  rankingMode: "weighted" | "rrf";
  rankingSignals?: RankingSignals;
}

export interface MalmungchiStats {
  name: string;
  generatedAt: string;
  documentCount: number;
  categoryCount: number;
  indexedDocumentCount: number;
  contentBytes: number;
  contentWordCount: number;
  schemaVersion: number;
  documentSlugs: string[];
  categorySlugs: string[];
  documentHashes: Record<string, string>;
  categoryHashes: Record<string, string>;
}

export interface MalmungchiManifest extends MalmungchiStats {}

export interface DocumentSectionRequest {
  slug?: string;
  guestName?: string;
  section: "metadata" | "summary" | "full";
}
