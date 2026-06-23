import path from "node:path";
import { buildDocumentCategoryIndex } from "../../src/ingest/build-index";
import { buildManifest } from "../../src/ingest/build-manifest";
import { enrichCategoryIndex } from "../../src/ingest/enrich-categories";
import { loadDocuments } from "../../src/ingest/load-documents";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";
import { DocumentService } from "../../src/service/document-service";
import { DocumentStore } from "../../src/service/document-store";

const DATA_DIR = path.join(import.meta.dir, "..", "..", "data");

export async function buildDocumentService() {
  const malmunchi = await loadDocuments(DATA_DIR);
  const manifest = await buildManifest(malmunchi, {
    name: "test-malmunchi",
    dataDir: DATA_DIR,
  });
  const baseIndex = buildDocumentCategoryIndex(malmunchi.documents, malmunchi.categories);
  const categoryIndex = enrichCategoryIndex(malmunchi.documents, malmunchi.categories, baseIndex);

  const store = new DocumentStore(
    new Map(malmunchi.documents.map((e) => [e.slug, e])),
    new Map(malmunchi.categories.map((t) => [t.slug, t])),
    categoryIndex,
    manifest
  );

  const engine = new FlexSearchEngine();
  await engine.build(malmunchi.documents, categoryIndex.documentToCategories, {
    dataDir: DATA_DIR,
  });

  return new DocumentService(store, engine);
}
