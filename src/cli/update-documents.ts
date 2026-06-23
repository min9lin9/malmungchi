import { loadDocumentsAndManifest } from "../bootstrap";
import { env } from "../config/env";
import { buildDocumentCategoryIndex } from "../ingest/build-index";
import { enrichCategoryIndex } from "../ingest/enrich-categories";
import { applyIncrementalUpdate } from "../ingest/incremental-update";
import { FlexSearchEngine } from "../search/flexsearch-engine";
import { DocumentStore } from "../service/document-store";
import { logger } from "../util/logger";

async function main() {
  const { malmunchi, manifest } = await loadDocumentsAndManifest(env.dataDir, env.instanceName);

  const baseCategoryIndex = buildDocumentCategoryIndex(malmunchi.documents, malmunchi.categories);
  const categoryIndex = enrichCategoryIndex(
    malmunchi.documents,
    malmunchi.categories,
    baseCategoryIndex
  );

  const store = new DocumentStore(
    new Map(malmunchi.documents.map((e) => [e.slug, e])),
    new Map(malmunchi.categories.map((t) => [t.slug, t])),
    categoryIndex,
    manifest
  );

  const engine = new FlexSearchEngine();
  await engine.build(malmunchi.documents, categoryIndex.documentToCategories, {
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
    logger.info("No malmunchi changes detected");
    return;
  }

  logger.info("Malmunchi updated incrementally", {
    ...diff,
    reindexedAll: result.reindexedAll,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
