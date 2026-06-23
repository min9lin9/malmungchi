import { loadCorpusAndManifest } from "../bootstrap";
import { env } from "../config/env";
import { buildDocumentCategoryIndex } from "../ingest/build-index";
import { enrichCategoryIndex } from "../ingest/enrich-categories";
import { FlexSearchEngine } from "../search/flexsearch-engine";
import { logger } from "../util/logger";

async function main() {
  logger.info(`Inspecting index in ${env.dataDir}...`);

  const { corpus, manifest } = await loadCorpusAndManifest(env.dataDir, env.corpusName);

  const baseCategoryIndex = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
  const categoryIndex = enrichCategoryIndex(corpus.documents, corpus.categories, baseCategoryIndex);
  const engine = new FlexSearchEngine();
  await engine.build(corpus.documents, categoryIndex.documentToCategories);

  const documentsWithoutCategories = corpus.documents.filter(
    (e: { slug: string }) => (categoryIndex.documentToCategories.get(e.slug)?.length ?? 0) === 0
  );

  const categoryDocumentCounts = Array.from(categoryIndex.categoryToDocuments.entries())
    .map(([slug, slugs]) => ({ slug, count: slugs.length }))
    .sort((a, b) => b.count - a.count);

  console.log(
    JSON.stringify(
      {
        manifest,
        documents: corpus.documents.length,
        categories: corpus.categories.length,
        documentsWithoutCategories: documentsWithoutCategories.length,
        topCategories: categoryDocumentCounts.slice(0, 10),
        bottomCategories: categoryDocumentCounts.slice(-10),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
