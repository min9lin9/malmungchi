import { describe, expect, it } from "bun:test";
import { authorPostToDocument } from "../../src/author/corpus/author-to-document";
import type { AuthorPost } from "../../src/author/domain/author-post";

describe("authorPostToDocument", () => {
  it("converts author posts to additive DocumentRecord metadata", () => {
    const post: AuthorPost = {
      authorId: "demo-author",
      documentSlug: "first-essay",
      slug: "author:demo-author:first-essay",
      title: "First Essay",
      sourceUrl: "file:///tmp/source.md",
      publishedAt: null,
      contentText: "Alpha product strategy.",
      contentMarkdown: "# First Essay\n\nAlpha product strategy.",
      contentHash: "hash",
    };

    const document = authorPostToDocument(post);

    expect(document.slug).toBe("author:demo-author:first-essay");
    expect(document.metadata.source).toBe("author");
    expect(document.metadata.authorId).toBe("demo-author");
    expect(document.metadata.originalUrl).toBe("file:///tmp/source.md");
    expect(document.transcript).toBe("Alpha product strategy.");
    expect(document.contentHash).toBe("hash");
  });
});
