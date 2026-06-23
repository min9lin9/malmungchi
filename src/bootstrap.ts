import path from "node:path";
import { env } from "./config/env";
import type { CorpusManifest } from "./domain/document";
import { buildDocumentCategoryIndex } from "./ingest/build-index";
import { buildManifest, readManifest, writeManifest } from "./ingest/build-manifest";
import { enrichCategoryIndex } from "./ingest/enrich-categories";
import { type Corpus, loadCorpus } from "./ingest/load-corpus";
import { createSearchEngine } from "./search/engine-factory";
import { CorpusStore } from "./service/corpus-store";
import { DocumentService } from "./service/document-service";
import { logger } from "./util/logger";

export interface BootstrapResult {
  corpus: Corpus;
  manifest: CorpusManifest;
}

export async function loadCorpusAndManifest(
  dataDir: string,
  corpusName: string
): Promise<BootstrapResult> {
  const manifestPath = path.join(dataDir, "manifest.json");
  const corpus = await loadCorpus(dataDir);

  let manifest = await readManifest(manifestPath);
  if (!manifest) {
    manifest = await buildManifest(corpus, { name: corpusName, dataDir });
    await writeManifest(manifest, manifestPath);
    logger.info("manifest rebuilt", { manifestPath });
  }

  return { corpus, manifest };
}

export async function buildService(dataDir: string, corpusName: string): Promise<DocumentService> {
  const { corpus, manifest } = await loadCorpusAndManifest(dataDir, corpusName);
  const defaultImportDir = path.join(env.dataDir, "imports");
  const authorImportDir =
    env.authorImportDir === defaultImportDir ? path.join(dataDir, "imports") : env.authorImportDir;
  const serviceEnv = {
    ...env,
    dataDir,
    documentsDir: path.join(dataDir, "documents"),
    categoriesDir: path.join(dataDir, "categories"),
    blogsDir: path.join(dataDir, "sources"),
    authorsDir: path.join(dataDir, "authors"),
    authorImportDir,
    manifestPath: path.join(dataDir, "manifest.json"),
    embeddingCacheDir: path.join(dataDir, ".cache", "embeddings"),
  };

  const baseCategoryIndex = buildDocumentCategoryIndex(corpus.documents, corpus.categories);
  const categoryIndex = enrichCategoryIndex(corpus.documents, corpus.categories, baseCategoryIndex);

  const store = new CorpusStore(
    new Map(corpus.documents.map((e: Corpus["documents"][number]) => [e.slug, e])),
    new Map(corpus.categories.map((t: Corpus["categories"][number]) => [t.slug, t])),
    categoryIndex,
    manifest
  );

  const engine = await createSearchEngine(serviceEnv);
  await engine.build(corpus.documents, categoryIndex.documentToCategories, {
    dataDir,
    manifest,
  });

  return new DocumentService(store, engine, serviceEnv);
}

export async function rebuildManifest(
  dataDir: string,
  corpusName: string
): Promise<CorpusManifest> {
  const corpus = await loadCorpus(dataDir);
  const manifest = await buildManifest(corpus, { name: corpusName, dataDir });
  await writeManifest(manifest, path.join(dataDir, "manifest.json"));
  return manifest;
}
