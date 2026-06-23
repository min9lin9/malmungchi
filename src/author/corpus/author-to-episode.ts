import type { Episode, EpisodeMetadata } from "../../domain/episode";
import type { AuthorPost } from "../domain/author-post";

export function authorPostToEpisode(post: AuthorPost): Episode {
  const metadata: EpisodeMetadata = {
    title: post.title,
    guest: post.authorId,
    publish_date: post.publishedAt ?? undefined,
    source: "author",
    authorId: post.authorId,
    originalUrl: post.sourceUrl,
  };

  const frontmatter = `---\ntitle: ${post.title}\nguest: ${post.authorId}\nsource: author\nauthor_id: ${post.authorId}\nsource_url: ${post.sourceUrl}\n---\n`;

  return {
    slug: post.slug,
    metadata,
    content: `${frontmatter}\n${post.contentMarkdown}`,
    transcript: post.contentText,
    wordCount: post.contentText.split(/\s+/).filter(Boolean).length,
    contentHash: post.contentHash,
  };
}

export function authorPostsToEpisodes(posts: AuthorPost[]): Episode[] {
  return posts.map(authorPostToEpisode);
}
