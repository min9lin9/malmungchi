import { loadCorpusAndManifest } from "../bootstrap";
import { env } from "../config/env";
import { buildDocumentCategoryIndex } from "../ingest/build-index";
import { enrichCategoryIndex } from "../ingest/enrich-categories";
import { applyIncrementalUpdate } from "../ingest/incremental-update";
import { FlexSearchEngine } from "../search/flexsearch-engine";
import { CorpusStore } from "../service/corpus-store";
import { logger } from "../util/logger";

async function main() {
  const { corpus, manifest } = await loadCorpusAndManifest(env.dataDir, env.corpusName);

  const baseCategoryIndex = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
  const categoryIndex = enrichCategoryIndex(corpus.documents, corpus.categories, baseCategoryIndex);

  const store = new CorpusStore(
    new Map(corpus.documents.map((e) => [e.slug, e])),
    new Map(corpus.categories.map((t) => [t.slug, t])),
    categoryIndex,
    manifest
  );

  const engine = new FlexSearchEngine();
  await engine.build(corpus.documents, categoryIndex.documentToCategories, {
    dataDir: env.dataDir,
    manifest,
  });

  const result = await applyIncrementalUpdate(store, engine, env.dataDir, env.corpusName);

  const diff = result.diff;
  const totalChanges =
    diff.addedDocuments.length +
    diff.changedDocuments.length +
    diff.removedDocuments.length +
    diff.addedCategories.length +
    diff.changedCategories.length +
    diff.removedCategories.length;

  if (totalChanges === 0) {
    logger.info("No corpus changes detected");
    return;
  }

  logger.info("Corpus updated incrementally", {
    ...diff,
    reindexedAll: result.reindexedAll,
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
