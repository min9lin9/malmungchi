import { describe, expect, it } from "bun:test";
import path from "node:path";
import { buildDocumentCategoryIndex } from "../src/ingest/build-index";
import { buildManifest } from "../src/ingest/build-manifest";
import { loadDocuments } from "../src/ingest/load-documents";

const DATA_DIR = path.join(import.meta.dir, "..", "data");

describe("data integrity", () => {
  it("every document has a slug and title or guest", async () => {
    const malmunchi = await loadDocuments(DATA_DIR);
    for (const document of malmunchi.documents) {
      expect(document.slug).toBeTruthy();
      expect(document.metadata.title || document.metadata.guest).toBeTruthy();
    }
  });

  it("every category references real documents", async () => {
    const malmunchi = await loadDocuments(DATA_DIR);
    const documentSlugs = new Set(malmunchi.documents.map((e) => e.slug));
    for (const category of malmunchi.categories) {
      for (const slug of category.documentSlugs) {
        expect(documentSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("manifest counts match malmunchi", async () => {
    const malmunchi = await loadDocuments(DATA_DIR);
    const manifest = await buildManifest(malmunchi, {
      name: "test-malmunchi",
      dataDir: DATA_DIR,
    });
    expect(manifest.documentCount).toBe(malmunchi.documents.length);
    expect(manifest.categoryCount).toBe(malmunchi.categories.length);
  });

  it("category index covers all documents", async () => {
    const malmunchi = await loadDocuments(DATA_DIR);
    const index = buildDocumentCategoryIndex(malmunchi.documents, malmunchi.categories);
    expect(index.documentToCategories.size).toBe(malmunchi.documents.length);
  });
});
