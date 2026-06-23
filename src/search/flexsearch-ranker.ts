import type { Document } from "flexsearch";
import type { DocumentRecord, RankingSignals, SearchInput, SearchResult } from "../domain/document";
import { buildRankingSignals, withRerankSignal } from "./explain";
import { normalizeQuery } from "./normalize";
import { type ParsedQuery, parseQuery } from "./query";
import { buildSnippet } from "./snippet";

export const FIELD_WEIGHTS: Record<string, number> = {
  title: 4,
  guest: 3,
  keywords: 3,
  transcript: 1,
};

export interface SemanticReranker {
  prepare?(documents: readonly DocumentRecord[]): Promise<void>;
  rerank(query: string, results: readonly SearchResult[]): Promise<SearchResult[]>;
}

export interface FlexSearchRankerContext {
  documents: Map<string, DocumentRecord>;
  documentSearchableText: Map<string, string>;
  documentWordSet: Map<string, Set<string>>;
  documentToCategories: Map<string, string[]>;
  maxResults: number;
  reranker?: SemanticReranker;
  rerankTimeoutMs: number;
}

export class FlexSearchRanker {
  constructor(
    private readonly index: Document<unknown, boolean>,
    private readonly context: FlexSearchRankerContext
  ) {}

  async searchWithTotal(input: SearchInput): Promise<{ results: SearchResult[]; total: number }> {
    const parsed = parseQuery(input.query);
    if (parsed.phrases.length === 0 && parsed.terms.length === 0) {
      return { results: [], total: 0 };
    }

    const rankingMode = input.rankingMode ?? "weighted";
    const candidates = this.collectCandidates(parsed, rankingMode, input.explain === true);
    const filtered = this.applyPostFilters(candidates, parsed, input);
    const normalized = this.normalizeScores(filtered);
    const keywordSorted = normalized.sort(
      (a, b) => b.score - a.score || a.slug.localeCompare(b.slug)
    );
    const sorted = await this.maybeRerank(input, keywordSorted);
    const { offset, limit } = this.resolvePagination(input);
    const page = sorted.slice(offset, offset + limit);
    return { results: this.attachSnippets(page, input.query), total: sorted.length };
  }

  private collectCandidates(
    parsed: ParsedQuery,
    rankingMode: "weighted" | "rrf",
    explain: boolean
  ): Map<string, SearchResult> {
    const candidates = new Map<string, SearchResult>();
    const query = [...parsed.phrases, ...parsed.terms]
      .map(normalizeQuery)
      .filter(Boolean)
      .join(" ");
    if (!query) return candidates;

    for (const result of this.searchIndex(query, 500, rankingMode, explain)) {
      candidates.set(result.slug, result);
    }
    return candidates;
  }

  private searchIndex(
    query: string,
    limit: number,
    rankingMode: "weighted" | "rrf",
    explain: boolean
  ): SearchResult[] {
    const raw = this.index.search(query, { limit, bool: "or" }) as Array<{
      field: string;
      result: string[];
    }>;
    const scores = new Map<string, number>();
    const fieldScores = new Map<string, Map<string, number>>();
    for (const fieldResult of raw) {
      const weight = FIELD_WEIGHTS[fieldResult.field] ?? 1;
      for (const [index, slug] of fieldResult.result.entries()) {
        const contribution = rankingMode === "rrf" ? weight / (60 + index + 1) : weight;
        scores.set(slug, (scores.get(slug) ?? 0) + contribution);
        if (explain) {
          const byField = fieldScores.get(slug) ?? new Map<string, number>();
          byField.set(fieldResult.field, (byField.get(fieldResult.field) ?? 0) + contribution);
          fieldScores.set(slug, byField);
        }
      }
    }
    return Array.from(scores.entries()).map(([slug, score]) =>
      this.toSearchResult(
        slug,
        score,
        rankingMode,
        buildRankingSignals({
          document: this.context.documents.get(slug),
          query,
          rankingMode,
          fieldScores: fieldScores.get(slug),
        })
      )
    );
  }

  private toSearchResult(
    slug: string,
    score: number,
    rankingMode: "weighted" | "rrf",
    rankingSignals?: RankingSignals
  ): SearchResult {
    const document = this.context.documents.get(slug);
    const source = this.resolveSource(document, slug);
    return {
      slug,
      title: document?.metadata.title ?? slug,
      guest: document?.metadata.guest ?? "",
      publishDate: document?.metadata.publish_date ?? "",
      score,
      snippet: "",
      categorySlugs: this.context.documentToCategories.get(slug) ?? [],
      sourceType: source.type,
      sourceId: source.id,
      rankingMode,
      rankingSignals,
    };
  }

  private resolveSource(
    document: DocumentRecord | undefined,
    slug: string
  ): { type: "author"; id: string } {
    if (document?.metadata.source === "author") {
      const authorId = document.metadata.authorId ?? slug.split(":")[1] ?? "unknown";
      return { type: "author", id: `author:${authorId}` };
    }
    return { type: "author", id: "author:unknown" };
  }

  private applyPostFilters(
    candidates: Map<string, SearchResult>,
    parsed: ParsedQuery,
    input: SearchInput
  ): SearchResult[] {
    return Array.from(candidates.values()).filter((result) => {
      const document = this.context.documents.get(result.slug);
      if (!document) return false;
      if (parsed.phrases.some((phrase) => !this.containsPhrase(document, phrase))) return false;
      if (parsed.terms.length > 0) {
        const matched = parsed.terms.filter((term) => this.containsTerm(document, term));
        const required = parsed.operator === "and" ? parsed.terms.length : 1;
        if (matched.length < required) return false;
      }
      return this.matchesInputFilters(result, input);
    });
  }

  private matchesInputFilters(result: SearchResult, input: SearchInput): boolean {
    if (input.guest && !result.guest.toLowerCase().includes(input.guest.toLowerCase())) {
      return false;
    }
    if (
      input.category &&
      !result.categorySlugs.some((category) =>
        category.toLowerCase().includes(input.category?.toLowerCase() ?? "")
      )
    ) {
      return false;
    }
    if (input.fromDate && result.publishDate && result.publishDate < input.fromDate) return false;
    if (input.toDate && result.publishDate && result.publishDate > input.toDate) return false;
    return true;
  }

  private containsPhrase(document: DocumentRecord, phrase: string): boolean {
    return this.getSearchableText(document).includes(phrase.toLowerCase());
  }

  private containsTerm(document: DocumentRecord, term: string): boolean {
    return this.context.documentWordSet.get(document.slug)?.has(term.toLowerCase()) ?? false;
  }

  private getSearchableText(document: DocumentRecord): string {
    return (
      this.context.documentSearchableText.get(document.slug) ??
      FlexSearchRanker.searchableText(document).toLowerCase()
    );
  }

  private attachSnippets(results: SearchResult[], query: string): SearchResult[] {
    return results.map((result) => {
      const document = this.context.documents.get(result.slug);
      return { ...result, snippet: document ? buildSnippet(document.transcript, query) : "" };
    });
  }

  private async maybeRerank(input: SearchInput, results: SearchResult[]): Promise<SearchResult[]> {
    if (input.rerank === false || !this.context.reranker || results.length === 0) {
      return input.explain === true
        ? withRerankSignal(results, { attempted: false, applied: false, reason: "disabled" })
        : results;
    }
    const pool = results.slice(0, 100);
    try {
      const reranked = await Promise.race([
        this.context.reranker.rerank(input.query, pool),
        new Promise<SearchResult[]>((_, reject) =>
          setTimeout(
            () => reject(new Error("Semantic rerank timed out")),
            this.context.rerankTimeoutMs
          )
        ),
      ]);
      const merged = [...reranked, ...results.slice(pool.length)];
      return input.explain === true
        ? withRerankSignal(merged, { attempted: true, applied: true })
        : merged;
    } catch {
      return input.explain === true
        ? withRerankSignal(results, {
            attempted: true,
            applied: false,
            reason: "failed_or_timed_out",
          })
        : results;
    }
  }

  private normalizeScores(results: SearchResult[]): SearchResult[] {
    if (results.length === 0) return results;
    const maxScore = Math.max(...results.map((result) => result.score));
    if (maxScore <= 0) return results;
    return results.map((result) => ({
      ...result,
      score: Math.round((result.score / maxScore) * 100) / 100,
    }));
  }

  private resolvePagination(input: SearchInput): { offset: number; limit: number } {
    const limit = Math.max(1, Math.min(50, input.limit ?? this.context.maxResults));
    const requestedOffset =
      input.page && input.page > 0 ? (input.page - 1) * limit : (input.offset ?? 0);
    return { offset: Math.max(0, requestedOffset), limit };
  }

  static searchableText(document: DocumentRecord): string {
    return [
      document.metadata.title ?? "",
      document.metadata.guest ?? "",
      (document.metadata.keywords ?? []).join(" "),
      document.transcript,
    ].join("\n");
  }
}
