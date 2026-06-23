import type { CorpusStats } from "../domain/document";

export interface ReadinessStatus {
  ready: boolean;
  checks: {
    corpusLoaded: boolean;
    searchIndexLoaded: boolean;
  };
  stats: Pick<CorpusStats, "documentCount" | "categoryCount" | "indexedDocumentCount">;
}
