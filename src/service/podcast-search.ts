import { DEFAULT_SEARCH_LIMIT } from "../config/constants";
import type { SearchInput, SearchResult } from "../domain/episode";
import {
  compareSearchExplanations,
  type SearchExplainCompareInput,
  type SearchExplainCompareResult,
} from "../search/compare";
import { logSearchTiming } from "../search/perf-log";
import type { SearchEngine } from "../search/search-engine";

export type SearchTranscriptResult = {
  readonly query: string;
  readonly returned: number;
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
  readonly results: SearchResult[];
};

export async function searchTranscriptsWithTiming(
  searchEngine: SearchEngine,
  input: SearchInput
): Promise<SearchTranscriptResult> {
  const start = performance.now();
  const { results, total } = await searchEngine.searchWithTotal(input);
  const elapsed = performance.now() - start;
  const limit = input.limit ?? DEFAULT_SEARCH_LIMIT;
  const offset = input.offset ?? (input.page && input.page > 0 ? (input.page - 1) * limit : 0);

  logSearchTiming({
    query: input.query,
    elapsedMs: elapsed,
    total,
    returned: results.length,
  });

  return {
    query: input.query,
    returned: results.length,
    total,
    offset,
    limit,
    results,
  };
}

export type { SearchExplainCompareInput, SearchExplainCompareResult };
export { compareSearchExplanations };
