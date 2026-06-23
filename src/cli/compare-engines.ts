import { loadCorpusAndManifest } from "../bootstrap";
import { env } from "../config/env";
import type { SearchInput } from "../domain/document";
import { buildDocumentCategoryIndex } from "../ingest/build-index";
import { enrichCategoryIndex } from "../ingest/enrich-categories";
import { FlexSearchEngine } from "../search/flexsearch-engine";
import { MeilisearchEngine } from "../search/meilisearch-engine";

const QUERIES: string[] = [
  "fundraising",
  "open source",
  "product market fit",
  "hiring",
  "revenue",
  "venture capital",
  "AI",
  "SaaS",
  "pricing",
  "enterprise sales",
];

function formatScore(n: number): string {
  return n.toFixed(3);
}

async function main() {
  const { corpus } = await loadCorpusAndManifest(env.dataDir, env.corpusName);
  const baseIndex = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
  const categoryIndex = enrichCategoryIndex(corpus.documents, corpus.categories, baseIndex);

  const flex = new FlexSearchEngine({ maxResults: env.maxResults });
  await flex.build(corpus.documents, categoryIndex.documentToCategories, {
    dataDir: env.dataDir,
  });

  const meili = new MeilisearchEngine({
    host: env.meiliHost,
    apiKey: env.meiliApiKey,
    indexName: `${env.meiliIndexName}-compare`,
  });
  await meili.build(corpus.documents, categoryIndex.documentToCategories);

  const input: SearchInput = { query: "", limit: 5 };

  console.log("query, flex_total, meili_total, flex_top, meili_top, overlap, flex_ms, meili_ms");

  for (const query of QUERIES) {
    input.query = query;

    const flexStart = performance.now();
    const flexResult = await flex.searchWithTotal(input);
    const flexMs = performance.now() - flexStart;

    const meiliStart = performance.now();
    const meiliResult = await meili.searchWithTotal(input);
    const meiliMs = performance.now() - meiliStart;

    const flexTop = flexResult.results.map((r) => r.slug);
    const meiliTop = meiliResult.results.map((r) => r.slug);
    const overlap = new Set(flexTop.filter((slug) => meiliTop.includes(slug)));

    console.log(
      [
        `"${query}"`,
        flexResult.total,
        meiliResult.total,
        flexTop.join("|"),
        meiliTop.join("|"),
        overlap.size,
        formatScore(flexMs),
        formatScore(meiliMs),
      ].join(", ")
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
