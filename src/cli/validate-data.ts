import { env } from "../config/env";
import { DataIntegrityError } from "../domain/errors";
import { buildEpisodeTopicIndex } from "../ingest/build-index";
import { buildManifest } from "../ingest/build-manifest";
import { loadCorpus } from "../ingest/load-corpus";

interface ValidationIssue {
  type: "error" | "warning";
  message: string;
}

async function validateData(): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const corpus = await loadCorpus(env.dataDir);

  // 1. All episodes must have a slug
  for (const episode of corpus.episodes) {
    if (!episode.slug) {
      issues.push({ type: "error", message: "Episode missing slug" });
    }
  }

  // 2. Every episode must have title or guest
  for (const episode of corpus.episodes) {
    if (!episode.metadata.title && !episode.metadata.guest) {
      issues.push({
        type: "error",
        message: `Episode "${episode.slug}" missing title and guest`,
      });
    }
  }

  // 3. Transcript files are loaded as UTF-8 by loadCorpus; empty content is suspicious
  for (const episode of corpus.episodes) {
    if (episode.content.trim().length === 0) {
      issues.push({
        type: "warning",
        message: `Episode "${episode.slug}" has empty content`,
      });
    }
  }

  // 4. Every topic entry references real episode slugs
  const episodeSlugs = new Set(corpus.episodes.map((e) => e.slug));
  for (const topic of corpus.topics) {
    for (const slug of topic.episodeSlugs) {
      if (!episodeSlugs.has(slug)) {
        issues.push({
          type: "error",
          message: `Topic "${topic.slug}" references unknown episode slug "${slug}"`,
        });
      }
    }
  }

  // 5. Manifest counts match
  const manifest = await buildManifest(corpus, {
    name: env.corpusName,
    dataDir: env.dataDir,
  });

  if (manifest.episodeCount !== corpus.episodes.length) {
    issues.push({
      type: "error",
      message: `Manifest episodeCount (${manifest.episodeCount}) does not match loaded episodes (${corpus.episodes.length})`,
    });
  }
  if (manifest.topicCount !== corpus.topics.length) {
    issues.push({
      type: "error",
      message: `Manifest topicCount (${manifest.topicCount}) does not match loaded topics (${corpus.topics.length})`,
    });
  }

  // 6. Search index covers all episodes
  const topicIndex = buildEpisodeTopicIndex(corpus.episodes, corpus.topics);
  const indexedCount = topicIndex.episodeToTopics.size;
  if (indexedCount !== corpus.episodes.length) {
    issues.push({
      type: "error",
      message: `Topic index covers ${indexedCount} episodes, expected ${corpus.episodes.length}`,
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
