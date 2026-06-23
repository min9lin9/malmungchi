import path from "node:path";
import { buildDocumentCategoryIndex } from "../../src/ingest/build-index";
import { buildManifest } from "../../src/ingest/build-manifest";
import { enrichCategoryIndex } from "../../src/ingest/enrich-categories";
import { loadCorpus } from "../../src/ingest/load-corpus";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";
import { CorpusStore } from "../../src/service/corpus-store";
import { DocumentService } from "../../src/service/document-service";

const FIXTURE_DIR = path.join(import.meta.dir, "..", "fixtures");

export async function buildFixtureDocumentService() {
  const corpus = await loadCorpus(FIXTURE_DIR);
  const manifest = await buildManifest(corpus, {
    name: "fixture-corpus",
    dataDir: FIXTURE_DIR,
  });
  const baseIndex = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
  const categoryIndex = enrichCategoryIndex(corpus.documents, corpus.categories, baseIndex);

  const store = new CorpusStore(
    new Map(corpus.documents.map((e) => [e.slug, e])),
    new Map(corpus.categories.map((t) => [t.slug, t])),
    categoryIndex,
    manifest
  );

  const engine = new FlexSearchEngine();
  await engine.build(corpus.documents, categoryIndex.documentToCategories);

  return new DocumentService(store, engine);
}
