import path from "node:path";
import { buildDocumentCategoryIndex } from "../../src/ingest/build-index";
import { buildManifest } from "../../src/ingest/build-manifest";
import { enrichCategoryIndex } from "../../src/ingest/enrich-categories";
import { loadDocuments } from "../../src/ingest/load-documents";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";
import { DocumentService } from "../../src/service/document-service";
import { DocumentStore } from "../../src/service/document-store";

const FIXTURE_DIR = path.join(import.meta.dir, "..", "fixtures");

export async function buildFixtureDocumentService() {
  const malmungchi = await loadDocuments(FIXTURE_DIR);
  const manifest = await buildManifest(malmungchi, {
    name: "fixture-malmungchi",
    dataDir: FIXTURE_DIR,
  });
  const baseIndex = buildDocumentCategoryIndex(malmungchi.documents, malmungchi.categories);
  const categoryIndex = enrichCategoryIndex(malmungchi.documents, malmungchi.categories, baseIndex);

  const store = new DocumentStore(
    new Map(malmungchi.documents.map((e) => [e.slug, e])),
    new Map(malmungchi.categories.map((t) => [t.slug, t])),
    categoryIndex,
    manifest
  );

  const engine = new FlexSearchEngine();
  await engine.build(malmungchi.documents, categoryIndex.documentToCategories);

  return new DocumentService(store, engine);
}
