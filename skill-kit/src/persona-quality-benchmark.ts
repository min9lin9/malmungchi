import type { BenchmarkDimension } from "./persona-benchmark.ts";
import { assertLocalCorpusUrl, redactSecrets } from "./security.ts";

export interface CorpusPersonaQualityReport {
  readonly corpusBacked: true;
  readonly authorId: string;
  readonly sourceId: string;
  readonly documentCount: number;
  readonly dimensions: {
    readonly retrievalGrounding: BenchmarkDimension;
    readonly citationCoverage: BenchmarkDimension;
    readonly koreanVoiceFidelity: BenchmarkDimension;
    readonly hallucinationGuard: BenchmarkDimension;
    readonly multiTurnReadiness: BenchmarkDimension;
    readonly overall: BenchmarkDimension;
  };
}

export async function evaluateCorpusPersonaQuality(options: {
  readonly corpusUrl: string;
  readonly authorId: string;
  readonly allowRemote: boolean;
}): Promise<CorpusPersonaQualityReport> {
  const sourceId = `author:${options.authorId}`;
  const value = await fetchCorpusSourceExport(options.corpusUrl, sourceId, {
    allowRemote: options.allowRemote,
  });
  const documents = exportDocuments(value);
  const maybePass = (ok: boolean): BenchmarkDimension =>
    ok ? { pass: true, score: 1 } : { pass: false, score: 0 };
  const hasDocuments = documents.length > 0;
  const allCorpusCitations = documents.every(
    (document) => document.sourceId === sourceId && document.provenanceSourceId === sourceId
  );
  const hasKorean = documents.some((document) => /[가-힣]/u.test(document.content));
  const noForbiddenClaims = documents.every(
    (document) => !/나는\s+실제|as the real person|I am the real/i.test(document.content)
  );
  const enoughForTurns =
    documents
      .map((document) => document.content)
      .join("\n")
      .split(/\s+/u)
      .filter(Boolean).length >= 8;
  const overall =
    hasDocuments && allCorpusCitations && hasKorean && noForbiddenClaims && enoughForTurns;
  return {
    corpusBacked: true,
    authorId: options.authorId,
    sourceId,
    documentCount: documents.length,
    dimensions: {
      retrievalGrounding: maybePass(hasDocuments),
      citationCoverage: maybePass(allCorpusCitations),
      koreanVoiceFidelity: maybePass(hasKorean),
      hallucinationGuard: maybePass(noForbiddenClaims),
      multiTurnReadiness: maybePass(enoughForTurns),
      overall: maybePass(overall),
    },
  };
}

async function fetchCorpusSourceExport(
  corpusUrl: string,
  sourceId: string,
  options: { readonly allowRemote: boolean }
): Promise<unknown> {
  const url = assertLocalCorpusUrl(corpusUrl, options.allowRemote);
  const exportUrl = new URL(`/corpus/sources/${encodeURIComponent(sourceId)}/export`, url);
  exportUrl.searchParams.set("format", "json");
  exportUrl.searchParams.set("includeHistory", "true");
  const response = await fetch(exportUrl);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Corpus source export failed ${response.status}: ${redactSecrets(text)}`);
  }
  return JSON.parse(text);
}

function exportDocuments(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.documents)) return [];
  return value.documents.filter(isRecord).map((document) => {
    const provenance = isRecord(document.provenance) ? document.provenance : {};
    return {
      content: stringField(document.content) ?? "",
      sourceId: stringField(document.sourceId),
      provenanceSourceId: stringField(provenance.sourceId),
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}
