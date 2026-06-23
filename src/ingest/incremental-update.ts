import fs from "node:fs/promises";
import path from "node:path";
import type { CorpusManifest, DocumentRecord } from "../domain/document";
import type { SearchEngine } from "../search/search-engine";
import type { CorpusStore } from "../service/corpus-store";
import { buildDocumentCategoryIndex } from "./build-index";
import { buildManifest, writeManifest } from "./build-manifest";
import { type CorpusDiff, diffCorpus } from "./diff-corpus";
import { enrichCategoryIndex } from "./enrich-categories";
import { type Corpus, loadCorpus } from "./load-corpus";

export interface IncrementalUpdateResult {
  diff: CorpusDiff;
  reindexedAll: boolean;
  manifest: CorpusManifest;
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
  store: CorpusStore,
  engine: SearchEngine,
  dataDir: string,
  corpusName: string
): Promise<IncrementalUpdateResult> {
  const diff = await diffCorpus(store.manifest, dataDir);

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

  const corpus = await loadCorpus(dataDir);
  const manifest = await buildManifest(corpus, { name: corpusName, dataDir });

  const categoryIndexChanged =
    diff.addedCategories.length > 0 ||
    diff.changedCategories.length > 0 ||
    diff.removedCategories.length > 0;

  if (categoryIndexChanged) {
    const baseCategoryIndex = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
    const categoryIndex = enrichCategoryIndex(
      corpus.documents,
      corpus.categories,
      baseCategoryIndex
    );

    const oldSlugs = Array.from(store.documents.keys());
    await engine.removeDocuments(oldSlugs);
    await engine.addDocuments(corpus.documents);

    store.documents = new Map(corpus.documents.map((e) => [e.slug, e]));
    store.categories = new Map(corpus.categories.map((t) => [t.slug, t]));
    store.categoryIndex = categoryIndex;
    store.manifest = manifest;

    await writeManifest(manifest, path.join(dataDir, "manifest.json"));
    await clearIndexCache(dataDir);

    return { diff, reindexedAll: true, manifest };
  }

  const slugsToRemove = unique([...diff.removedDocuments, ...diff.changedDocuments]);
  const slugsToAdd = unique([...diff.addedDocuments, ...diff.changedDocuments]);
  const documentsToAdd = slugsToAdd
    .map((slug) => corpus.documents.find((e) => e.slug === slug))
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
  manifest: CorpusManifest,
  dataDir: string
): Promise<boolean> {
  const diff = await diffCorpus(manifest, dataDir);
  return (
    diff.addedDocuments.length > 0 ||
    diff.changedDocuments.length > 0 ||
    diff.removedDocuments.length > 0 ||
    diff.addedCategories.length > 0 ||
    diff.changedCategories.length > 0 ||
    diff.removedCategories.length > 0
  );
}

export { type Corpus, type CorpusDiff, diffCorpus };
