import type { Category, DocumentRecord } from "../domain/document";

export interface DocumentCategoryIndex {
  documentToCategories: Map<string, string[]>;
  categoryToDocuments: Map<string, string[]>;
}

export function buildDocumentCategoryIndex(
  documents: DocumentRecord[],
  categories: Category[]
): DocumentCategoryIndex {
  const documentSlugs = new Set(documents.map((e) => e.slug));
  const documentToCategories = new Map<string, string[]>();
  const categoryToDocuments = new Map<string, string[]>();

  for (const document of documents) {
    documentToCategories.set(document.slug, []);
  }

  for (const category of categories) {
    const validSlugs = category.documentSlugs.filter((slug) => documentSlugs.has(slug));
    categoryToDocuments.set(category.slug, validSlugs);
    for (const slug of validSlugs) {
      const list = documentToCategories.get(slug) ?? [];
      list.push(category.slug);
      documentToCategories.set(slug, list);
    }
  }

  for (const [slug, list] of documentToCategories) {
    documentToCategories.set(slug, Array.from(new Set(list)).sort());
  }

  return { documentToCategories, categoryToDocuments };
}
