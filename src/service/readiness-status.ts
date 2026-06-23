import type { MalmunchiStats } from "../domain/document";

export interface ReadinessStatus {
  ready: boolean;
  checks: {
    documentsLoaded: boolean;
    searchIndexLoaded: boolean;
  };
  stats: Pick<MalmunchiStats, "documentCount" | "categoryCount" | "indexedDocumentCount">;
}
