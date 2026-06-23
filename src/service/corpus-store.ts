import type { Category, CorpusManifest, DocumentRecord } from "../domain/document";
import type { DocumentCategoryIndex } from "../ingest/build-index";

export class CorpusStore {
  constructor(
    public documents: Map<string, DocumentRecord>,
    public categories: Map<string, Category>,
    public categoryIndex: DocumentCategoryIndex,
    public manifest: CorpusManifest
  ) {}

  getDocument(slug: string): DocumentRecord | undefined {
    return this.documents.get(slug);
  }

  getCategory(slug: string): Category | undefined {
    return this.categories.get(slug);
  }

  getCategorySlugsForDocument(slug: string): string[] {
    return this.categoryIndex.documentToCategories.get(slug) ?? [];
  }

  listDocumentsForCategory(slug: string): DocumentRecord[] {
    const slugs = this.categoryIndex.categoryToDocuments.get(slug) ?? [];
    return slugs
      .map((s) => this.documents.get(s))
      .filter((e): e is DocumentRecord => e !== undefined);
  }

  get allDocuments(): DocumentRecord[] {
    return Array.from(this.documents.values());
  }

  get allCategories(): Category[] {
    return Array.from(this.categories.values());
  }
}
