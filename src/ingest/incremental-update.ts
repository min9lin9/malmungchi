import fs from "node:fs/promises";
import path from "node:path";
import type { DocumentRecord, MalmungchiManifest } from "../domain/document";
import type { SearchEngine } from "../search/search-engine";
import type { DocumentStore } from "../service/document-store";
import { buildDocumentCategoryIndex } from "./build-index";
import { buildManifest, writeManifest } from "./build-manifest";
import { type DocumentCollectionDiff, diffDocuments } from "./diff-documents";
import { enrichCategoryIndex } from "./enrich-categories";
import { type DocumentCollection, loadDocuments } from "./load-documents";

export interface IncrementalUpdateResult {
  diff: DocumentCollectionDiff;
  reindexedAll: boolean;
  manifest: MalmungchiManifest;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function getCacheFile(dataDir: string): string {
  return path.join(dataDir, ".cache", "flexsearch-index.json");
}

async function clearIndexCache(dataDir: string): Promise<void> {
  try {
    await fs.rm(getCacheFile(dataDir), { force: true });
  } catch {
    // ignore
  }
}

export async function applyIncrementalUpdate(
  store: DocumentStore,
  engine: SearchEngine,
  dataDir: string,
  instanceName: string
): Promise<IncrementalUpdateResult> {
  const diff = await diffDocuments(store.manifest, dataDir);

  const hasAnyChange =
    diff.addedDocuments.length > 0 ||
    diff.changedDocuments.length > 0 ||
    diff.removedDocuments.length > 0 ||
    diff.addedCategories.length > 0 ||
    diff.changedCategories.length > 0 ||
    diff.removedCategories.length > 0;

  if (!hasAnyChange) {
    return { diff, reindexedAll: false, manifest: store.manifest };
  }

  const malmungchi = await loadDocuments(dataDir);
  const manifest = await buildManifest(malmungchi, { name: instanceName, dataDir });

  const categoryIndexChanged =
    diff.addedCategories.length > 0 ||
    diff.changedCategories.length > 0 ||
    diff.removedCategories.length > 0;

  if (categoryIndexChanged) {
    const baseCategoryIndex = buildDocumentCategoryIndex(
      malmungchi.documents,
      malmungchi.categories
    );
    const categoryIndex = enrichCategoryIndex(
      malmungchi.documents,
      malmungchi.categories,
      baseCategoryIndex
    );

    const oldSlugs = Array.from(store.documents.keys());
    await engine.removeDocuments(oldSlugs);
    await engine.addDocuments(malmungchi.documents);

    store.documents = new Map(malmungchi.documents.map((e) => [e.slug, e]));
    store.categories = new Map(malmungchi.categories.map((t) => [t.slug, t]));
    store.categoryIndex = categoryIndex;
    store.manifest = manifest;

    await writeManifest(manifest, path.join(dataDir, "manifest.json"));
    await clearIndexCache(dataDir);

    return { diff, reindexedAll: true, manifest };
  }

  const slugsToRemove = unique([...diff.removedDocuments, ...diff.changedDocuments]);
  const slugsToAdd = unique([...diff.addedDocuments, ...diff.changedDocuments]);
  const documentsToAdd = slugsToAdd
    .map((slug) => malmungchi.documents.find((e) => e.slug === slug))
    .filter((e): e is DocumentRecord => e !== undefined);

  if (slugsToRemove.length > 0) {
    await engine.removeDocuments(slugsToRemove);
  }
  if (documentsToAdd.length > 0) {
    await engine.addDocuments(documentsToAdd);
  }

  for (const slug of diff.removedDocuments) {
    store.documents.delete(slug);
  }
  for (const document of documentsToAdd) {
    store.documents.set(document.slug, document);
  }
  store.manifest = manifest;

  await writeManifest(manifest, path.join(dataDir, "manifest.json"));
  await clearIndexCache(dataDir);

  return { diff, reindexedAll: false, manifest };
}

export async function canIncrementalUpdate(
  manifest: MalmungchiManifest,
  dataDir: string
): Promise<boolean> {
  const diff = await diffDocuments(manifest, dataDir);
  return (
    diff.addedDocuments.length > 0 ||
    diff.changedDocuments.length > 0 ||
    diff.removedDocuments.length > 0 ||
    diff.addedCategories.length > 0 ||
    diff.changedCategories.length > 0 ||
    diff.removedCategories.length > 0
  );
}

export { type DocumentCollection, type DocumentCollectionDiff, diffDocuments };
