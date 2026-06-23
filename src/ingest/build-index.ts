import type { Episode, Topic } from "../domain/episode";

export interface EpisodeTopicIndex {
  episodeToTopics: Map<string, string[]>;
  topicToEpisodes: Map<string, string[]>;
}

export function buildEpisodeTopicIndex(episodes: Episode[], topics: Topic[]): EpisodeTopicIndex {
  const episodeSlugs = new Set(episodes.map((e) => e.slug));
  const episodeToTopics = new Map<string, string[]>();
  const topicToEpisodes = new Map<string, string[]>();

  for (const episode of episodes) {
    episodeToTopics.set(episode.slug, []);
  }

  for (const topic of topics) {
    const validSlugs = topic.episodeSlugs.filter((slug) => episodeSlugs.has(slug));
    topicToEpisodes.set(topic.slug, validSlugs);
    for (const slug of validSlugs) {
      const list = episodeToTopics.get(slug) ?? [];
      list.push(topic.slug);
      episodeToTopics.set(slug, list);
    }
  }

  for (const [slug, list] of episodeToTopics) {
    episodeToTopics.set(slug, Array.from(new Set(list)).sort());
  }

  return { episodeToTopics, topicToEpisodes };
}
