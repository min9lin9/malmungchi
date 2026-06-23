import path from "node:path";
import { buildDocumentCategoryIndex } from "../../src/ingest/build-index";
import { enrichCategoryIndex } from "../../src/ingest/enrich-categories";
import { loadDocuments } from "../../src/ingest/load-documents";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";

const DATA_DIR = path.join(import.meta.dir, "..", "..", "data");

export async function buildEngine() {
  const malmungchi = await loadDocuments(DATA_DIR);
  const baseIndex = buildDocumentCategoryIndex(malmungchi.documents, malmungchi.categories);
  const index = enrichCategoryIndex(malmungchi.documents, malmungchi.categories, baseIndex);
  const engine = new FlexSearchEngine();
  await engine.build(malmungchi.documents, index.documentToCategories, {
    dataDir: DATA_DIR,
  });
  return engine;
}
