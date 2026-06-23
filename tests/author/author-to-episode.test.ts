import { describe, expect, it } from "bun:test";
import { authorPostToEpisode } from "../../src/author/corpus/author-to-episode";
import type { AuthorPost } from "../../src/author/domain/author-post";

describe("authorPostToEpisode", () => {
  it("converts author posts to additive Episode metadata", () => {
    const post: AuthorPost = {
      authorId: "demo-author",
      episodeSlug: "first-essay",
      slug: "author:demo-author:first-essay",
      title: "First Essay",
      sourceUrl: "file:///tmp/source.md",
      publishedAt: null,
      contentText: "Alpha product strategy.",
      contentMarkdown: "# First Essay\n\nAlpha product strategy.",
      contentHash: "hash",
    };

    const episode = authorPostToEpisode(post);

    expect(episode.slug).toBe("author:demo-author:first-essay");
    expect(episode.metadata.source).toBe("author");
    expect(episode.metadata.authorId).toBe("demo-author");
    expect(episode.metadata.originalUrl).toBe("file:///tmp/source.md");
    expect(episode.transcript).toBe("Alpha product strategy.");
    expect(episode.contentHash).toBe("hash");
  });
});
