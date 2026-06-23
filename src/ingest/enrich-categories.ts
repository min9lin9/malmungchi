import type { Category, DocumentRecord } from "../domain/document";
import type { DocumentCategoryIndex } from "./build-index";

export function enrichCategoryIndex(
  documents: DocumentRecord[],
  categories: Category[],
  categoryIndex: DocumentCategoryIndex
): DocumentCategoryIndex {
  const documentToCategories = new Map(categoryIndex.documentToCategories);
  const categoryToDocuments = new Map(categoryIndex.categoryToDocuments);
  const categorySlugs = new Set(categories.map((t) => t.slug));

  for (const document of documents) {
    const currentCategories = new Set(documentToCategories.get(document.slug) ?? []);
    const keywords = document.metadata.keywords ?? [];

    for (const keyword of keywords) {
      const normalized = keyword
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      if (!normalized) continue;

      if (categorySlugs.has(normalized) && !currentCategories.has(normalized)) {
        currentCategories.add(normalized);

        const categoryList = categoryToDocuments.get(normalized) ?? [];
        if (!categoryList.includes(document.slug)) {
          categoryList.push(document.slug);
          categoryToDocuments.set(normalized, categoryList);
        }
      }
    }

    documentToCategories.set(document.slug, Array.from(currentCategories).sort());
  }

  for (const [slug, slugs] of categoryToDocuments) {
    categoryToDocuments.set(slug, Array.from(new Set(slugs)).sort());
  }

  return { documentToCategories, categoryToDocuments };
}
