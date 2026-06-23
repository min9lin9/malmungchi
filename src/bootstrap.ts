import path from "node:path";
import { env } from "./config/env";
import type { MalmungchiManifest } from "./domain/document";
import { buildDocumentCategoryIndex } from "./ingest/build-index";
import { buildManifest, readManifest, writeManifest } from "./ingest/build-manifest";
import { enrichCategoryIndex } from "./ingest/enrich-categories";
import { type DocumentCollection, loadDocuments } from "./ingest/load-documents";
import { createSearchEngine } from "./search/engine-factory";
import { DocumentService } from "./service/document-service";
import { DocumentStore } from "./service/document-store";
import { logger } from "./util/logger";

export interface BootstrapResult {
  malmungchi: DocumentCollection;
  manifest: MalmungchiManifest;
}

export async function loadDocumentsAndManifest(
  dataDir: string,
  instanceName: string
): Promise<BootstrapResult> {
  const manifestPath = path.join(dataDir, "manifest.json");
  const malmungchi = await loadDocuments(dataDir);

  let manifest = await readManifest(manifestPath);
  if (!manifest) {
    manifest = await buildManifest(malmungchi, { name: instanceName, dataDir });
    await writeManifest(manifest, manifestPath);
    logger.info("manifest rebuilt", { manifestPath });
  }

  return { malmungchi, manifest };
}

export async function buildService(
  dataDir: string,
  instanceName: string
): Promise<DocumentService> {
  const { malmungchi, manifest } = await loadDocumentsAndManifest(dataDir, instanceName);
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

  const baseCategoryIndex = buildDocumentCategoryIndex(malmungchi.documents, malmungchi.categories);
  const categoryIndex = enrichCategoryIndex(
    malmungchi.documents,
    malmungchi.categories,
    baseCategoryIndex
  );

  const store = new DocumentStore(
    new Map(malmungchi.documents.map((document) => [document.slug, document])),
    new Map(malmungchi.categories.map((category) => [category.slug, category])),
    categoryIndex,
    manifest
  );

  const engine = await createSearchEngine(serviceEnv);
  await engine.build(malmungchi.documents, categoryIndex.documentToCategories, {
    dataDir,
    manifest,
  });

  return new DocumentService(store, engine, serviceEnv);
}

export async function rebuildManifest(
  dataDir: string,
  instanceName: string
): Promise<MalmungchiManifest> {
  const malmungchi = await loadDocuments(dataDir);
  const manifest = await buildManifest(malmungchi, { name: instanceName, dataDir });
  await writeManifest(manifest, path.join(dataDir, "manifest.json"));
  return manifest;
}
