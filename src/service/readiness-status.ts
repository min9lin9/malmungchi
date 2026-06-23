import type { MalmungchiStats } from "../domain/document";

export interface ReadinessStatus {
  ready: boolean;
  checks: {
    documentsLoaded: boolean;
    searchIndexLoaded: boolean;
  };
  stats: Pick<MalmungchiStats, "documentCount" | "categoryCount" | "indexedDocumentCount">;
}
