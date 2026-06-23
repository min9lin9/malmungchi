import path from "node:path";
import { buildDocumentCategoryIndex } from "../../src/ingest/build-index";
import { enrichCategoryIndex } from "../../src/ingest/enrich-categories";
import { loadCorpus } from "../../src/ingest/load-corpus";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";

const FIXTURE_DIR = path.join(import.meta.dir, "..", "fixtures");

export async function buildFixtureEngine() {
  const corpus = await loadCorpus(FIXTURE_DIR);
  const baseIndex = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
  const index = enrichCategoryIndex(corpus.documents, corpus.categories, baseIndex);
  const engine = new FlexSearchEngine();
  await engine.build(corpus.documents, index.documentToCategories);
  return engine;
}
