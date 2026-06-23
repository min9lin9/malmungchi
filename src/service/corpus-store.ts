import type { CorpusManifest, Episode, Topic } from "../domain/episode";
import type { EpisodeTopicIndex } from "../ingest/build-index";

export class CorpusStore {
  constructor(
    public episodes: Map<string, Episode>,
    public topics: Map<string, Topic>,
    public topicIndex: EpisodeTopicIndex,
    public manifest: CorpusManifest
  ) {}

  getEpisode(slug: string): Episode | undefined {
    return this.episodes.get(slug);
  }

  getTopic(slug: string): Topic | undefined {
    return this.topics.get(slug);
  }

  getTopicSlugsForEpisode(slug: string): string[] {
    return this.topicIndex.episodeToTopics.get(slug) ?? [];
  }

  listEpisodesForTopic(slug: string): Episode[] {
    const slugs = this.topicIndex.topicToEpisodes.get(slug) ?? [];
    return slugs.map((s) => this.episodes.get(s)).filter((e): e is Episode => e !== undefined);
  }

  get allEpisodes(): Episode[] {
    return Array.from(this.episodes.values());
  }

  get allTopics(): Topic[] {
    return Array.from(this.topics.values());
  }
}
