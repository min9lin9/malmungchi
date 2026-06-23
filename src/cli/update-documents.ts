import { loadDocumentsAndManifest } from "../bootstrap";
import { env } from "../config/env";
import { buildDocumentCategoryIndex } from "../ingest/build-index";
import { enrichCategoryIndex } from "../ingest/enrich-categories";
import { applyIncrementalUpdate } from "../ingest/incremental-update";
import { FlexSearchEngine } from "../search/flexsearch-engine";
import { DocumentStore } from "../service/document-store";
import { logger } from "../util/logger";

async function main() {
  const { malmungchi, manifest } = await loadDocumentsAndManifest(env.dataDir, env.instanceName);

  const baseCategoryIndex = buildDocumentCategoryIndex(malmungchi.documents, malmungchi.categories);
  const categoryIndex = enrichCategoryIndex(
    malmungchi.documents,
    malmungchi.categories,
    baseCategoryIndex
  );

  const store = new DocumentStore(
    new Map(malmungchi.documents.map((e) => [e.slug, e])),
    new Map(malmungchi.categories.map((t) => [t.slug, t])),
    categoryIndex,
    manifest
  );

  const engine = new FlexSearchEngine();
  await engine.build(malmungchi.documents, categoryIndex.documentToCategories, {
    dataDir: env.dataDir,
    manifest,
  });

  const result = await applyIncrementalUpdate(store, engine, env.dataDir, env.instanceName);

  const diff = result.diff;
  const totalChanges =
    diff.addedDocuments.length +
    diff.changedDocuments.length +
    diff.removedDocuments.length +
    diff.addedCategories.length +
    diff.changedCategories.length +
    diff.removedCategories.length;

  if (totalChanges === 0) {
    logger.info("No malmungchi changes detected");
    return;
  }

  logger.info("Malmungchi updated incrementally", {
    ...diff,
    reindexedAll: result.reindexedAll,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
