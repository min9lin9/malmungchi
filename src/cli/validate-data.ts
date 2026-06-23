import { env } from "../config/env";
import { DataIntegrityError } from "../domain/errors";
import { buildDocumentCategoryIndex } from "../ingest/build-index";
import { buildManifest } from "../ingest/build-manifest";
import { loadDocuments } from "../ingest/load-documents";

interface ValidationIssue {
  type: "error" | "warning";
  message: string;
}

async function validateData(): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const malmungchi = await loadDocuments(env.dataDir);

  // 1. All documents must have a slug
  for (const document of malmungchi.documents) {
    if (!document.slug) {
      issues.push({ type: "error", message: "DocumentRecord missing slug" });
    }
  }

  // 2. Every document must have title or guest
  for (const document of malmungchi.documents) {
    if (!document.metadata.title && !document.metadata.guest) {
      issues.push({
        type: "error",
        message: `DocumentRecord "${document.slug}" missing title and guest`,
      });
    }
  }

  // 3. Transcript files are loaded as UTF-8 by loadDocuments; empty content is suspicious
  for (const document of malmungchi.documents) {
    if (document.content.trim().length === 0) {
      issues.push({
        type: "warning",
        message: `DocumentRecord "${document.slug}" has empty content`,
      });
    }
  }

  // 4. Every category entry references real document slugs
  const documentSlugs = new Set(malmungchi.documents.map((e) => e.slug));
  for (const category of malmungchi.categories) {
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
  const manifest = await buildManifest(malmungchi, {
    name: env.instanceName,
    dataDir: env.dataDir,
  });

  if (manifest.documentCount !== malmungchi.documents.length) {
    issues.push({
      type: "error",
      message: `Manifest documentCount (${manifest.documentCount}) does not match loaded documents (${malmungchi.documents.length})`,
    });
  }
  if (manifest.categoryCount !== malmungchi.categories.length) {
    issues.push({
      type: "error",
      message: `Manifest categoryCount (${manifest.categoryCount}) does not match loaded categories (${malmungchi.categories.length})`,
    });
  }

  // 6. Search index covers all documents
  const categoryIndex = buildDocumentCategoryIndex(malmungchi.documents, malmungchi.categories);
  const indexedCount = categoryIndex.documentToCategories.size;
  if (indexedCount !== malmungchi.documents.length) {
    issues.push({
      type: "error",
      message: `Category index covers ${indexedCount} documents, expected ${malmungchi.documents.length}`,
    });
  }

  return issues;
}

async function main() {
  console.error(`Validating malmungchi in ${env.dataDir}...`);
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
