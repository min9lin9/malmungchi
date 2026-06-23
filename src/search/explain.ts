import type { Episode, RankingSignals, SearchResult } from "../domain/episode";
import { buildSnippet } from "./snippet";

export function buildRankingSignals(input: {
  readonly episode?: Episode;
  readonly query: string;
  readonly rankingMode: "weighted" | "rrf";
  readonly fieldScores?: Map<string, number>;
}): RankingSignals | undefined {
  if (!input.fieldScores || input.fieldScores.size === 0) return undefined;
  const matchedFields = Array.from(input.fieldScores.keys()).sort();
  const total = Array.from(input.fieldScores.values()).reduce((sum, score) => sum + score, 0);
  return {
    matchedFields,
    fieldScores: Object.fromEntries(input.fieldScores),
    rawScore: total,
    normalizedScore: total,
    rankingMode: input.rankingMode,
    normalizedFieldScores: Object.fromEntries(
      matchedFields.map((field) => {
        const score = input.fieldScores?.get(field) ?? 0;
        return [field, total > 0 ? Math.round((score / total) * 100) / 100 : 0];
      })
    ),
    evidence: buildEvidence(input.episode, input.query, matchedFields),
  };
}

function buildEvidence(
  episode: Episode | undefined,
  query: string,
  fields: readonly string[]
): Array<{ field: string; snippet: string }> {
  if (!episode) return [];
  return fields.map((field) => ({
    field,
    snippet: getFieldSnippet(episode, field, query),
  }));
}

function getFieldSnippet(episode: Episode, field: string, query: string): string {
  switch (field) {
    case "title":
      return episode.metadata.title ?? episode.slug;
    case "guest":
      return episode.metadata.guest ?? "";
    case "keywords":
      return (episode.metadata.keywords ?? []).join(" ");
    case "transcript":
      return buildSnippet(episode.transcript, query);
    default:
      return "";
  }
}

export function withRerankSignal(
  results: readonly SearchResult[],
  rerank: NonNullable<RankingSignals["rerank"]>
): SearchResult[] {
  return results.map((result) => ({
    ...result,
    rankingSignals: result.rankingSignals ? { ...result.rankingSignals, rerank } : undefined,
  }));
}
