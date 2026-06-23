import type { DocumentMetadata, DocumentRecord } from "../../domain/document";
import type { AuthorPost } from "../domain/author-post";

export function authorPostToDocument(post: AuthorPost): DocumentRecord {
  const metadata: DocumentMetadata = {
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

export function authorPostsToDocuments(posts: AuthorPost[]): DocumentRecord[] {
  return posts.map(authorPostToDocument);
}
