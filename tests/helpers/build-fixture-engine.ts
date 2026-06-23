import path from "node:path";
import { buildDocumentCategoryIndex } from "../../src/ingest/build-index";
import { enrichCategoryIndex } from "../../src/ingest/enrich-categories";
import { loadDocuments } from "../../src/ingest/load-documents";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";

const FIXTURE_DIR = path.join(import.meta.dir, "..", "fixtures");

export async function buildFixtureEngine() {
  const malmunchi = await loadDocuments(FIXTURE_DIR);
  const baseIndex = buildDocumentCategoryIndex(malmunchi.documents, malmunchi.categories);
  const index = enrichCategoryIndex(malmunchi.documents, malmunchi.categories, baseIndex);
  const engine = new FlexSearchEngine();
  await engine.build(malmunchi.documents, index.documentToCategories);
  return engine;
}
