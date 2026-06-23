import { authorPostToEpisode } from "../author/corpus/author-to-episode";
import type { AuthorPost } from "../author/domain/author-post";
import type { Episode } from "../domain/episode";
import { writeManifest } from "../ingest/build-manifest";
import type { SearchEngine } from "../search/search-engine";
import type { CorpusStore } from "./corpus-store";

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
    private readonly store: CorpusStore,
    private readonly searchEngine: SearchEngine,
    private readonly manifestPath?: string
  ) {}

  async importAuthorPosts(posts: readonly AuthorPost[], options?: ImportMutationOptions) {
    return this.applyEpisodes(
      posts.map((post) => ({
        slug: post.slug,
        contentHash: post.contentHash,
        episode: authorPostToEpisode(post),
        onApply: () => undefined,
      })),
      options
    );
  }

  async removeEpisodes(slugs: readonly string[]): Promise<void> {
    const removed: Episode[] = [];
    for (const slug of slugs) {
      const episode = this.store.getEpisode(slug);
      if (!episode) continue;
      removed.push(episode);
      this.store.episodes.delete(slug);
    }
    if (removed.length === 0) return;
    await this.searchEngine.removeDocuments(removed.map((episode) => episode.slug));
    this.updateManifestForRemovedEpisodes(removed);
    if (this.manifestPath) {
      await writeManifest(this.store.manifest, this.manifestPath);
    }
  }

  private async applyEpisodes(
    inputs: Array<{
      slug: string;
      contentHash: string;
      episode: Episode;
      onApply: () => void;
    }>,
    options?: ImportMutationOptions
  ): Promise<ImportMutationResult> {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const episodesToAdd: Episode[] = [];
    const episodesToUpdate: Array<{ previous: Episode; next: Episode }> = [];
    const changes: ImportMutationChange[] = [];

    for (const input of inputs) {
      const previous = this.store.getEpisode(input.slug);
      if (previous?.contentHash === input.contentHash) {
        skipped++;
        changes.push({
          slug: input.slug,
          title: input.episode.metadata.title ?? input.slug,
          action: "skipped",
          previousHash: previous.contentHash,
          nextHash: input.contentHash,
        });
        continue;
      }
      if (previous) {
        updated++;
        episodesToUpdate.push({ previous, next: input.episode });
        changes.push({
          slug: input.slug,
          title: input.episode.metadata.title ?? input.slug,
          action: "updated",
          previousHash: previous.contentHash,
          nextHash: input.contentHash,
        });
      } else {
        added++;
        episodesToAdd.push(input.episode);
        changes.push({
          slug: input.slug,
          title: input.episode.metadata.title ?? input.slug,
          action: "added",
          nextHash: input.contentHash,
        });
      }
      if (!options?.dryRun) {
        input.onApply();
        this.store.episodes.set(input.slug, input.episode);
      }
    }

    if (!options?.dryRun) {
      await this.updateSearchAndManifest(episodesToAdd, episodesToUpdate);
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
    episodesToAdd: Episode[],
    episodesToUpdate: Array<{ previous: Episode; next: Episode }>
  ): Promise<void> {
    if (episodesToAdd.length > 0) {
      await this.searchEngine.addDocuments(episodesToAdd);
      this.updateManifestForNewEpisodes(episodesToAdd);
    }

    if (episodesToUpdate.length > 0) {
      const nextEpisodes = episodesToUpdate.map((entry) => entry.next);
      const slugs = nextEpisodes.map((episode) => episode.slug);
      await this.searchEngine.removeDocuments(slugs);
      await this.searchEngine.addDocuments(nextEpisodes);
      this.updateManifestForUpdatedEpisodes(episodesToUpdate);
    }

    if (this.manifestPath) {
      await writeManifest(this.store.manifest, this.manifestPath);
    }
  }

  private updateManifestForNewEpisodes(episodes: Episode[]): void {
    const manifest = this.store.manifest;
    for (const slug of episodes.map((episode) => episode.slug)) {
      if (!manifest.episodeSlugs.includes(slug)) {
        manifest.episodeSlugs.push(slug);
      }
    }
    manifest.episodeSlugs.sort();
    manifest.episodeCount += episodes.length;
    manifest.indexedEpisodeCount += episodes.length;

    for (const episode of episodes) {
      manifest.transcriptBytes += Buffer.byteLength(episode.content, "utf-8");
      manifest.transcriptWordCount += episode.wordCount;
      this.updateEpisodeHash(episode);
    }
    manifest.generatedAt = new Date().toISOString();
  }

  private updateManifestForUpdatedEpisodes(episodes: Array<{ previous: Episode; next: Episode }>) {
    const manifest = this.store.manifest;
    for (const { previous, next } of episodes) {
      manifest.transcriptBytes -= Buffer.byteLength(previous.content, "utf-8");
      manifest.transcriptWordCount -= previous.wordCount;
      manifest.transcriptBytes += Buffer.byteLength(next.content, "utf-8");
      manifest.transcriptWordCount += next.wordCount;
      this.updateEpisodeHash(next);
    }
    manifest.generatedAt = new Date().toISOString();
  }

  private updateManifestForRemovedEpisodes(episodes: readonly Episode[]): void {
    const manifest = this.store.manifest;
    const removedSlugs = new Set(episodes.map((episode) => episode.slug));
    manifest.episodeSlugs = manifest.episodeSlugs.filter((slug) => !removedSlugs.has(slug));
    manifest.episodeCount -= episodes.length;
    manifest.indexedEpisodeCount -= episodes.length;
    for (const episode of episodes) {
      manifest.transcriptBytes -= Buffer.byteLength(episode.content, "utf-8");
      manifest.transcriptWordCount -= episode.wordCount;
      delete manifest.episodeHashes[episode.slug];
    }
    manifest.generatedAt = new Date().toISOString();
  }

  private updateEpisodeHash(episode: Episode): void {
    this.store.manifest.episodeHashes[episode.slug] = episode.contentHash ?? "";
  }
}
