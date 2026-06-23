import { env } from "../config/env";
import { DataIntegrityError } from "../domain/errors";
import { buildDocumentCategoryIndex } from "../ingest/build-index";
import { buildManifest } from "../ingest/build-manifest";
import { loadCorpus } from "../ingest/load-corpus";

interface ValidationIssue {
  type: "error" | "warning";
  message: string;
}

async function validateData(): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const corpus = await loadCorpus(env.dataDir);

  // 1. All documents must have a slug
  for (const document of corpus.documents) {
    if (!document.slug) {
      issues.push({ type: "error", message: "DocumentRecord missing slug" });
    }
  }

  // 2. Every document must have title or guest
  for (const document of corpus.documents) {
    if (!document.metadata.title && !document.metadata.guest) {
      issues.push({
        type: "error",
        message: `DocumentRecord "${document.slug}" missing title and guest`,
      });
    }
  }

  // 3. Transcript files are loaded as UTF-8 by loadCorpus; empty content is suspicious
  for (const document of corpus.documents) {
    if (document.content.trim().length === 0) {
      issues.push({
        type: "warning",
        message: `DocumentRecord "${document.slug}" has empty content`,
      });
    }
  }

  // 4. Every category entry references real document slugs
  const documentSlugs = new Set(corpus.documents.map((e) => e.slug));
  for (const category of corpus.categories) {
    for (const slug of category.documentSlugs) {
      if (!documentSlugs.has(slug)) {
        issues.push({
          type: "error",
          message: `Category "${category.slug}" references unknown document slug "${slug}"`,
        });
      }
    }
  }

  // 5. Manifest counts match
  const manifest = await buildManifest(corpus, {
    name: env.corpusName,
    dataDir: env.dataDir,
  });

  if (manifest.documentCount !== corpus.documents.length) {
    issues.push({
      type: "error",
      message: `Manifest documentCount (${manifest.documentCount}) does not match loaded documents (${corpus.documents.length})`,
    });
  }
  if (manifest.categoryCount !== corpus.categories.length) {
    issues.push({
      type: "error",
      message: `Manifest categoryCount (${manifest.categoryCount}) does not match loaded categories (${corpus.categories.length})`,
    });
  }

  // 6. Search index covers all documents
  const categoryIndex = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
  const indexedCount = categoryIndex.documentToCategories.size;
  if (indexedCount !== corpus.documents.length) {
    issues.push({
      type: "error",
      message: `Category index covers ${indexedCount} documents, expected ${corpus.documents.length}`,
    });
  }

  return issues;
}

async function main() {
  console.error(`Validating corpus in ${env.dataDir}...`);
  const issues = await validateData();

  const errors = issues.filter((i) => i.type === "error");
  const warnings = issues.filter((i) => i.type === "warning");

  for (const issue of issues) {
    console.error(`[${issue.type.toUpperCase()}] ${issue.message}`);
  }

  console.error(`Validation complete: ${errors.length} errors, ${warnings.length} warnings.`);

  if (errors.length > 0) {
    throw new DataIntegrityError(`Data validation failed with ${errors.length} errors`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
