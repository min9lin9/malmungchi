import type { CorpusStats, SearchResult } from "../domain/episode";
import type { LlmStatus } from "../llm/llm-status";
import type { ImportAuthorResult } from "../service/podcast-service";

export function formatSearchResults(
  query: string,
  results: SearchResult[],
  maxChars: number,
  total?: number,
  offset?: number,
  limit?: number
): string {
  const lines: string[] = [`# Search Results: "${query}"`, ""];

  if (total !== undefined) {
    lines.push(
      `Showing ${(offset ?? 0) + 1}–${(offset ?? 0) + results.length} of ${total} matches`
    );
  } else {
    lines.push(`Returned: ${results.length}`);
  }
  if (limit) {
    lines.push(`Page size: ${limit}`);
  }
  lines.push("");

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`## ${i + 1}. ${r.title}`);
    lines.push(`- Source: ${r.sourceId}`);
    lines.push(`- Ranking: ${r.rankingMode}`);
    if (r.guest) lines.push(`- Guest: ${r.guest}`);
    if (r.publishDate) lines.push(`- Published: ${r.publishDate}`);
    if (r.topicSlugs.length > 0) lines.push(`- Topics: ${r.topicSlugs.join(", ")}`);
    lines.push(`- Score: ${r.score.toFixed(2)}`);
    if (r.rankingSignals) {
      lines.push(`- Matched fields: ${r.rankingSignals.matchedFields.join(", ")}`);
      lines.push(`- Raw score: ${r.rankingSignals.rawScore.toFixed(2)}`);
      lines.push(`- Normalized score: ${r.rankingSignals.normalizedScore.toFixed(2)}`);
      lines.push(`- Field scores: ${formatScores(r.rankingSignals.fieldScores)}`);
      if (r.rankingSignals.normalizedFieldScores) {
        lines.push(`- Field score shares: ${formatScores(r.rankingSignals.normalizedFieldScores)}`);
      }
      if (r.rankingSignals.rerank) {
        lines.push(
          `- Rerank: ${r.rankingSignals.rerank.applied ? "applied" : "not applied"}${
            r.rankingSignals.rerank.reason ? ` (${r.rankingSignals.rerank.reason})` : ""
          }`
        );
      }
      if (r.rankingSignals.evidence && r.rankingSignals.evidence.length > 0) {
        lines.push("- Evidence:");
        for (const item of r.rankingSignals.evidence) {
          lines.push(`  - ${item.field}: ${item.snippet.replace(/\n+/g, " ")}`);
        }
      }
    }
    lines.push("");
    lines.push(`> ${r.snippet.replace(/\n+/g, " ")}`);
    lines.push("");
    lines.push(`Use get_document({ slug: "${r.slug}", section: "summary" }) for more.`);
    lines.push("");

    const joined = lines.join("\n");
    if (joined.length > maxChars) {
      return `${joined.slice(0, maxChars)}\n\n...(truncated)`;
    }
  }

  return lines.join("\n");
}

function formatScores(scores: Record<string, number>): string {
  return Object.entries(scores)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([field, score]) => `${field}=${score.toFixed(2)}`)
    .join(", ");
}

export function formatDocument(
  slug: string,
  section: string,
  content: string,
  maxChars: number
): string {
  const header = `# Document: ${slug}\n\n*Section: ${section}*\n\n`;
  const output = header + content;
  if (output.length > maxChars) {
    return `${output.slice(0, maxChars)}\n\n...(truncated)`;
  }
  return output;
}

export function formatCorpusStats(stats: CorpusStats): string {
  const lines = [
    `# Corpus Stats: ${stats.name}`,
    "",
    `- Documents: ${stats.episodeCount}`,
    `- Categories: ${stats.topicCount}`,
    `- Indexed documents: ${stats.indexedEpisodeCount}`,
    `- Content bytes: ${stats.transcriptBytes.toLocaleString()}`,
    `- Content words: ${stats.transcriptWordCount.toLocaleString()}`,
    `- Generated at: ${stats.generatedAt}`,
    `- Schema version: ${stats.schemaVersion}`,
  ];
  return lines.join("\n");
}

export function formatImportAuthorResult(result: ImportAuthorResult): string {
  return [
    `# Imported Author: ${result.authorId}`,
    "",
    `- Posts imported: ${result.importedPosts}`,
    `- Posts updated: ${result.updatedPosts}`,
    `- Posts skipped (unchanged): ${result.skippedPosts}`,
    result.savedTo ? `- Saved to: ${result.savedTo}` : "",
    "",
    "Documents are now searchable via search_documents.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatLlmStatus(status: LlmStatus): string {
  return [
    "# LLM Status",
    "",
    `- Provider: ${status.provider}`,
    `- Model: ${status.model}`,
    `- Authenticated: ${status.authenticated ? "yes" : "no"}`,
    `- Auth source: ${status.authSource}`,
    `- Last success: ${status.lastSuccessAt ?? "never"}`,
    `- Last failure: ${status.lastFailureAt ?? "never"}`,
    status.lastError ? `- Last error: ${status.lastError}` : "",
    status.quotaRemaining !== null ? `- Quota remaining: ${status.quotaRemaining}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
