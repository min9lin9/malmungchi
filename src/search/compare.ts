import type { RankingSignals, SearchInput, SearchResult } from "../domain/episode";
import type { SearchEngine } from "./search-engine";

export interface SearchExplainCompareInput {
  readonly query: string;
  readonly limit?: number;
  readonly topic?: string;
  readonly guest?: string;
  readonly fromDate?: string;
  readonly toDate?: string;
}

export interface SearchExplainCompareItem {
  readonly slug: string;
  readonly weightedRank?: number;
  readonly rrfRank?: number;
  readonly rankDelta?: number;
  readonly weightedSignals?: RankingSignals;
  readonly rrfSignals?: RankingSignals;
}

export type SearchExplainCompareResult =
  | {
      readonly supported: true;
      readonly engine: "flexsearch";
      readonly query: string;
      readonly limit: number;
      readonly overlap: number;
      readonly weightedTop: readonly string[];
      readonly rrfTop: readonly string[];
      readonly items: readonly SearchExplainCompareItem[];
    }
  | {
      readonly supported: false;
      readonly engine: "meilisearch";
      readonly reason: "engine-managed-ranking";
      readonly query: string;
      readonly weightedTop: readonly [];
      readonly rrfTop: readonly [];
      readonly items: readonly [];
    };

export async function compareSearchExplanations(
  engine: SearchEngine,
  input: SearchExplainCompareInput
): Promise<SearchExplainCompareResult> {
  if (engine.engineType === "meilisearch") {
    return {
      supported: false,
      engine: "meilisearch",
      reason: "engine-managed-ranking",
      query: input.query,
      weightedTop: [],
      rrfTop: [],
      items: [],
    };
  }
  const limit = Math.max(1, Math.min(50, input.limit ?? 10));
  const base: Omit<SearchInput, "rankingMode"> = {
    query: input.query,
    limit,
    topic: input.topic,
    guest: input.guest,
    fromDate: input.fromDate,
    toDate: input.toDate,
    rerank: false,
    explain: true,
  };
  const weighted = await engine.search({ ...base, rankingMode: "weighted" });
  const rrf = await engine.search({ ...base, rankingMode: "rrf" });
  const weightedTop = weighted.map((result) => result.slug);
  const rrfTop = rrf.map((result) => result.slug);
  const rrfSlugs = new Set(rrfTop);
  const items = buildItems(weighted, rrf);
  return {
    supported: true,
    engine: "flexsearch",
    query: input.query,
    limit,
    overlap: weightedTop.filter((slug) => rrfSlugs.has(slug)).length,
    weightedTop,
    rrfTop,
    items,
  };
}

function buildItems(
  weighted: readonly SearchResult[],
  rrf: readonly SearchResult[]
): readonly SearchExplainCompareItem[] {
  const bySlug = new Map<string, SearchExplainCompareItem>();
  weighted.forEach((result, index) => {
    bySlug.set(result.slug, {
      slug: result.slug,
      weightedRank: index + 1,
      weightedSignals: result.rankingSignals,
    });
  });
  rrf.forEach((result, index) => {
    const previous = bySlug.get(result.slug) ?? { slug: result.slug };
    const rrfRank = index + 1;
    bySlug.set(result.slug, {
      ...previous,
      rrfRank,
      rankDelta: previous.weightedRank === undefined ? undefined : rrfRank - previous.weightedRank,
      rrfSignals: result.rankingSignals,
    });
  });
  return Array.from(bySlug.values()).sort((left, right) =>
    (left.weightedRank ?? Number.MAX_SAFE_INTEGER) ===
    (right.weightedRank ?? Number.MAX_SAFE_INTEGER)
      ? (left.rrfRank ?? Number.MAX_SAFE_INTEGER) - (right.rrfRank ?? Number.MAX_SAFE_INTEGER)
      : (left.weightedRank ?? Number.MAX_SAFE_INTEGER) -
        (right.weightedRank ?? Number.MAX_SAFE_INTEGER)
  );
}
