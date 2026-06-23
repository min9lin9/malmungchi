import { authorPostToDocument } from "../author/document/author-to-document";
import type { AuthorPost } from "../author/domain/author-post";
import type { DocumentRecord } from "../domain/document";
import { writeManifest } from "../ingest/build-manifest";
import type { SearchEngine } from "../search/search-engine";
import type { DocumentStore } from "./document-store";

export interface ImportMutationResult {
  added: number;
  updated: number;
  skipped: number;
  addedSlugs: readonly string[];
  updatedSlugs: readonly string[];
  skippedSlugs: readonly string[];
  changes: ImportMutationChanges;
}

export type ImportMutationAction = "added" | "updated" | "skipped";

export interface ImportMutationChanges {
  readonly addedSlugs: readonly string[];
  readonly updatedSlugs: readonly string[];
  readonly skippedSlugs: readonly string[];
  readonly documents?: readonly ImportMutationChange[];
}

export interface ImportMutationChange {
  readonly slug: string;
  readonly title: string;
  readonly action: ImportMutationAction;
  readonly previousHash?: string;
  readonly nextHash: string;
}

export type ImportMutationOptions = { readonly dryRun?: boolean };

export class ImportMutations {
  constructor(
    private readonly store: DocumentStore,
    private readonly searchEngine: SearchEngine,
    private readonly manifestPath?: string
  ) {}

  async importAuthorPosts(posts: readonly AuthorPost[], options?: ImportMutationOptions) {
    return this.applyDocuments(
      posts.map((post) => ({
        slug: post.slug,
        contentHash: post.contentHash,
        document: authorPostToDocument(post),
        onApply: () => undefined,
      })),
      options
    );
  }

  async removeDocuments(slugs: readonly string[]): Promise<void> {
    const removed: DocumentRecord[] = [];
    for (const slug of slugs) {
      const document = this.store.getDocument(slug);
      if (!document) continue;
      removed.push(document);
      this.store.documents.delete(slug);
    }
    if (removed.length === 0) return;
    await this.searchEngine.removeDocuments(removed.map((document) => document.slug));
    this.updateManifestForRemovedDocuments(removed);
    if (this.manifestPath) {
      await writeManifest(this.store.manifest, this.manifestPath);
    }
  }

  private async applyDocuments(
    inputs: Array<{
      slug: string;
      contentHash: string;
      document: DocumentRecord;
      onApply: () => void;
    }>,
    options?: ImportMutationOptions
  ): Promise<ImportMutationResult> {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const documentsToAdd: DocumentRecord[] = [];
    const documentsToUpdate: Array<{ previous: DocumentRecord; next: DocumentRecord }> = [];
    const changes: ImportMutationChange[] = [];

    for (const input of inputs) {
      const previous = this.store.getDocument(input.slug);
      if (previous?.contentHash === input.contentHash) {
        skipped++;
        changes.push({
          slug: input.slug,
          title: input.document.metadata.title ?? input.slug,
          action: "skipped",
          previousHash: previous.contentHash,
          nextHash: input.contentHash,
        });
        continue;
      }
      if (previous) {
        updated++;
        documentsToUpdate.push({ previous, next: input.document });
        changes.push({
          slug: input.slug,
          title: input.document.metadata.title ?? input.slug,
          action: "updated",
          previousHash: previous.contentHash,
          nextHash: input.contentHash,
        });
      } else {
        added++;
        documentsToAdd.push(input.document);
        changes.push({
          slug: input.slug,
          title: input.document.metadata.title ?? input.slug,
          action: "added",
          nextHash: input.contentHash,
        });
      }
      if (!options?.dryRun) {
        input.onApply();
        this.store.documents.set(input.slug, input.document);
      }
    }

    if (!options?.dryRun) {
      await this.updateSearchAndManifest(documentsToAdd, documentsToUpdate);
    }
    const addedSlugs = changes
      .filter((change) => change.action === "added")
      .map((change) => change.slug);
    const updatedSlugs = changes
      .filter((change) => change.action === "updated")
      .map((change) => change.slug);
    const skippedSlugs = changes
      .filter((change) => change.action === "skipped")
      .map((change) => change.slug);

    return {
      added,
      updated,
      skipped,
      addedSlugs,
      updatedSlugs,
      skippedSlugs,
      changes: {
        addedSlugs,
        updatedSlugs,
        skippedSlugs,
        documents: changes,
      },
    };
  }

  private async updateSearchAndManifest(
    documentsToAdd: DocumentRecord[],
    documentsToUpdate: Array<{ previous: DocumentRecord; next: DocumentRecord }>
  ): Promise<void> {
    if (documentsToAdd.length > 0) {
      await this.searchEngine.addDocuments(documentsToAdd);
      this.updateManifestForNewDocuments(documentsToAdd);
    }

    if (documentsToUpdate.length > 0) {
      const nextDocuments = documentsToUpdate.map((entry) => entry.next);
      const slugs = nextDocuments.map((document) => document.slug);
      await this.searchEngine.removeDocuments(slugs);
      await this.searchEngine.addDocuments(nextDocuments);
      this.updateManifestForUpdatedDocuments(documentsToUpdate);
    }

    if (this.manifestPath) {
      await writeManifest(this.store.manifest, this.manifestPath);
    }
  }

  private updateManifestForNewDocuments(documents: DocumentRecord[]): void {
    const manifest = this.store.manifest;
    for (const slug of documents.map((document) => document.slug)) {
      if (!manifest.documentSlugs.includes(slug)) {
        manifest.documentSlugs.push(slug);
      }
    }
    manifest.documentSlugs.sort();
    manifest.documentCount += documents.length;
    manifest.indexedDocumentCount += documents.length;

    for (const document of documents) {
      manifest.contentBytes += Buffer.byteLength(document.content, "utf-8");
      manifest.contentWordCount += document.wordCount;
      this.updateDocumentHash(document);
    }
    manifest.generatedAt = new Date().toISOString();
  }

  private updateManifestForUpdatedDocuments(
    documents: Array<{ previous: DocumentRecord; next: DocumentRecord }>
  ) {
    const manifest = this.store.manifest;
    for (const { previous, next } of documents) {
      manifest.contentBytes -= Buffer.byteLength(previous.content, "utf-8");
      manifest.contentWordCount -= previous.wordCount;
      manifest.contentBytes += Buffer.byteLength(next.content, "utf-8");
      manifest.contentWordCount += next.wordCount;
      this.updateDocumentHash(next);
    }
    manifest.generatedAt = new Date().toISOString();
  }

  private updateManifestForRemovedDocuments(documents: readonly DocumentRecord[]): void {
    const manifest = this.store.manifest;
    const removedSlugs = new Set(documents.map((document) => document.slug));
    manifest.documentSlugs = manifest.documentSlugs.filter((slug) => !removedSlugs.has(slug));
    manifest.documentCount -= documents.length;
    manifest.indexedDocumentCount -= documents.length;
    for (const document of documents) {
      manifest.contentBytes -= Buffer.byteLength(document.content, "utf-8");
      manifest.contentWordCount -= document.wordCount;
      delete manifest.documentHashes[document.slug];
    }
    manifest.generatedAt = new Date().toISOString();
  }

  private updateDocumentHash(document: DocumentRecord): void {
    this.store.manifest.documentHashes[document.slug] = document.contentHash ?? "";
  }
}
