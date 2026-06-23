import type { CorpusStats } from "../domain/episode";

export interface ReadinessStatus {
  ready: boolean;
  checks: {
    corpusLoaded: boolean;
    searchIndexLoaded: boolean;
  };
  stats: Pick<CorpusStats, "episodeCount" | "topicCount" | "indexedEpisodeCount">;
}
