import type { Episode, Topic } from "../domain/episode";
import type { EpisodeTopicIndex } from "./build-index";

export function enrichTopicIndex(
  episodes: Episode[],
  topics: Topic[],
  topicIndex: EpisodeTopicIndex
): EpisodeTopicIndex {
  const episodeToTopics = new Map(topicIndex.episodeToTopics);
  const topicToEpisodes = new Map(topicIndex.topicToEpisodes);
  const topicSlugs = new Set(topics.map((t) => t.slug));

  for (const episode of episodes) {
    const currentTopics = new Set(episodeToTopics.get(episode.slug) ?? []);
    const keywords = episode.metadata.keywords ?? [];

    for (const keyword of keywords) {
      const normalized = keyword
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (!normalized) continue;

      if (topicSlugs.has(normalized) && !currentTopics.has(normalized)) {
        currentTopics.add(normalized);

        const topicList = topicToEpisodes.get(normalized) ?? [];
        if (!topicList.includes(episode.slug)) {
          topicList.push(episode.slug);
          topicToEpisodes.set(normalized, topicList);
        }
      }
    }

    episodeToTopics.set(episode.slug, Array.from(currentTopics).sort());
  }

  for (const [slug, slugs] of topicToEpisodes) {
    topicToEpisodes.set(slug, Array.from(new Set(slugs)).sort());
  }

  return { episodeToTopics, topicToEpisodes };
}
