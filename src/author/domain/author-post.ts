export interface AuthorPost {
  authorId: string;
  episodeSlug: string;
  slug: string;
  title: string;
  sourceUrl: string;
  publishedAt: string | null;
  contentText: string;
  contentMarkdown: string;
  contentHash: string;
}

export interface AuthorImportResult {
  authorId: string;
  source: string;
  posts: AuthorPost[];
}

export function createAuthorSlug(authorId: string, episodeSlug: string): string {
  return `author:${authorId}:${episodeSlug}`;
}

export function parseAuthorSlug(slug: string): { authorId: string; episodeSlug: string } | null {
  const match = /^author:([^:]+):([^:]+)$/.exec(slug);
  if (!match) return null;
  return { authorId: match[1], episodeSlug: match[2] };
}
