import path from "node:path";
import { env } from "./config/env";
import type { MalmunchiManifest } from "./domain/document";
import { buildDocumentCategoryIndex } from "./ingest/build-index";
import { buildManifest, readManifest, writeManifest } from "./ingest/build-manifest";
import { enrichCategoryIndex } from "./ingest/enrich-categories";
import { type DocumentCollection, loadDocuments } from "./ingest/load-documents";
import { createSearchEngine } from "./search/engine-factory";
import { DocumentService } from "./service/document-service";
import { DocumentStore } from "./service/document-store";
import { logger } from "./util/logger";

export interface BootstrapResult {
  malmunchi: DocumentCollection;
  manifest: MalmunchiManifest;
}

export async function loadDocumentsAndManifest(
  dataDir: string,
  instanceName: string
): Promise<BootstrapResult> {
  const manifestPath = path.join(dataDir, "manifest.json");
  const malmunchi = await loadDocuments(dataDir);

  let manifest = await readManifest(manifestPath);
  if (!manifest) {
    manifest = await buildManifest(malmunchi, { name: instanceName, dataDir });
    await writeManifest(manifest, manifestPath);
    logger.info("manifest rebuilt", { manifestPath });
  }

  return { malmunchi, manifest };
}

export async function buildService(
  dataDir: string,
  instanceName: string
): Promise<DocumentService> {
  const { malmunchi, manifest } = await loadDocumentsAndManifest(dataDir, instanceName);
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

  const baseCategoryIndex = buildDocumentCategoryIndex(malmunchi.documents, malmunchi.categories);
  const categoryIndex = enrichCategoryIndex(
    malmunchi.documents,
    malmunchi.categories,
    baseCategoryIndex
  );

  const store = new DocumentStore(
    new Map(malmunchi.documents.map((document) => [document.slug, document])),
    new Map(malmunchi.categories.map((category) => [category.slug, category])),
    categoryIndex,
    manifest
  );

  const engine = await createSearchEngine(serviceEnv);
  await engine.build(malmunchi.documents, categoryIndex.documentToCategories, {
    dataDir,
    manifest,
  });

  return new DocumentService(store, engine, serviceEnv);
}

export async function rebuildManifest(
  dataDir: string,
  instanceName: string
): Promise<MalmunchiManifest> {
  const malmunchi = await loadDocuments(dataDir);
  const manifest = await buildManifest(malmunchi, { name: instanceName, dataDir });
  await writeManifest(manifest, path.join(dataDir, "manifest.json"));
  return manifest;
}
