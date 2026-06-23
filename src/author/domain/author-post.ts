export interface AuthorPost {
  authorId: string;
  documentSlug: string;
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

export function createAuthorSlug(authorId: string, documentSlug: string): string {
  return `author:${authorId}:${documentSlug}`;
}

export function parseAuthorSlug(slug: string): { authorId: string; documentSlug: string } | null {
  const match = /^author:([^:]+):([^:]+)$/.exec(slug);
  if (!match) return null;
  return { authorId: match[1], documentSlug: match[2] };
}
