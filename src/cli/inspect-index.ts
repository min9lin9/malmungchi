import { loadDocumentsAndManifest } from "../bootstrap";
import { env } from "../config/env";
import { buildDocumentCategoryIndex } from "../ingest/build-index";
import { enrichCategoryIndex } from "../ingest/enrich-categories";
import { FlexSearchEngine } from "../search/flexsearch-engine";
import { logger } from "../util/logger";

async function main() {
  logger.info(`Inspecting index in ${env.dataDir}...`);

  const { malmungchi, manifest } = await loadDocumentsAndManifest(env.dataDir, env.instanceName);

  const baseCategoryIndex = buildDocumentCategoryIndex(malmungchi.documents, malmungchi.categories);
  const categoryIndex = enrichCategoryIndex(
    malmungchi.documents,
    malmungchi.categories,
    baseCategoryIndex
  );
  const engine = new FlexSearchEngine();
  await engine.build(malmungchi.documents, categoryIndex.documentToCategories);

  const documentsWithoutCategories = malmungchi.documents.filter(
    (e: { slug: string }) => (categoryIndex.documentToCategories.get(e.slug)?.length ?? 0) === 0
  );

  const categoryDocumentCounts = Array.from(categoryIndex.categoryToDocuments.entries())
    .map(([slug, slugs]) => ({ slug, count: slugs.length }))
    .sort((a, b) => b.count - a.count);

  console.log(
    JSON.stringify(
      {
        manifest,
        documents: malmungchi.documents.length,
        categories: malmungchi.categories.length,
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
