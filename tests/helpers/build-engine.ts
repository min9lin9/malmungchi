import path from "node:path";
import { buildDocumentCategoryIndex } from "../../src/ingest/build-index";
import { enrichCategoryIndex } from "../../src/ingest/enrich-categories";
import { loadCorpus } from "../../src/ingest/load-corpus";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";

const DATA_DIR = path.join(import.meta.dir, "..", "..", "data");

export async function buildEngine() {
  const corpus = await loadCorpus(DATA_DIR);
  const baseIndex = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
  const index = enrichCategoryIndex(corpus.documents, corpus.categories, baseIndex);
  const engine = new FlexSearchEngine();
  await engine.build(corpus.documents, index.documentToCategories, {
    dataDir: DATA_DIR,
  });
  return engine;
}
