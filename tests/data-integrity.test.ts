import { describe, expect, it } from "bun:test";
import path from "node:path";
import { buildDocumentCategoryIndex } from "../src/ingest/build-index";
import { buildManifest } from "../src/ingest/build-manifest";
import { loadCorpus } from "../src/ingest/load-corpus";

const DATA_DIR = path.join(import.meta.dir, "..", "data");

describe("data integrity", () => {
  it("every document has a slug and title or guest", async () => {
    const corpus = await loadCorpus(DATA_DIR);
    for (const document of corpus.documents) {
      expect(document.slug).toBeTruthy();
      expect(document.metadata.title || document.metadata.guest).toBeTruthy();
    }
  });

  it("every category references real documents", async () => {
    const corpus = await loadCorpus(DATA_DIR);
    const documentSlugs = new Set(corpus.documents.map((e) => e.slug));
    for (const category of corpus.categories) {
      for (const slug of category.documentSlugs) {
        expect(documentSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("manifest counts match corpus", async () => {
    const corpus = await loadCorpus(DATA_DIR);
    const manifest = await buildManifest(corpus, {
      name: "test-corpus",
      dataDir: DATA_DIR,
    });
    expect(manifest.documentCount).toBe(corpus.documents.length);
    expect(manifest.categoryCount).toBe(corpus.categories.length);
  });

  it("category index covers all documents", async () => {
    const corpus = await loadCorpus(DATA_DIR);
    const index = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
    expect(index.documentToCategories.size).toBe(corpus.documents.length);
  });
});
