import { describe, expect, it } from "bun:test";
import type { DocumentRecord } from "../../src/domain/document";
import { FlexSearchEngine } from "../../src/search/flexsearch-engine";

function document(slug: string, title: string, transcript: string): DocumentRecord {
  return {
    slug,
    metadata: { title },
    content: transcript,
    transcript,
    wordCount: transcript.split(/\s+/).length,
  };
}

describe("FlexSearchEngine RRF ranking", () => {
  it("can rank candidates with reciprocal rank fusion when requested", async () => {
    const engine = new FlexSearchEngine();
    await engine.build(
      [
        document("title-only", "alpha", "background text"),
        document("transcript-repeat", "background", "alpha alpha alpha alpha"),
        document("balanced", "alpha", "alpha context"),
      ],
      new Map()
    );

    const weighted = await engine.search({
      query: "alpha",
      limit: 3,
      rerank: false,
      rankingMode: "weighted",
    });
    const rrf = await engine.search({
      query: "alpha",
      limit: 3,
      rerank: false,
      rankingMode: "rrf",
    });

    expect(weighted[0].rankingMode).toBe("weighted");
    expect(rrf[0].rankingMode).toBe("rrf");
    expect(rrf[0].slug).toBe("balanced");
  });

  it("adds source metadata to search results", async () => {
    const engine = new FlexSearchEngine();
    await engine.build(
      [
        {
          ...document("author:demo:essay", "Essay", "memory layer"),
          metadata: { title: "Essay", source: "author", authorId: "demo" },
        },
      ],
      new Map()
    );

    const results = await engine.search({ query: "memory", limit: 1, rerank: false });

    expect(results[0]).toEqual(
      expect.objectContaining({
        sourceType: "author",
        sourceId: "author:demo",
        rankingMode: "weighted",
      })
    );
  });

  it("can explain field-level ranking signals", async () => {
    const engine = new FlexSearchEngine();
    await engine.build(
      [document("explainable", "memory", "memory layer with source lifecycle")],
      new Map()
    );

    const results = await engine.search({
      query: "memory",
      limit: 1,
      rerank: false,
      explain: true,
    });

    expect(results[0].rankingSignals).toEqual(
      expect.objectContaining({
        matchedFields: expect.arrayContaining(["title", "transcript"]),
        fieldScores: expect.objectContaining({
          title: expect.any(Number),
          transcript: expect.any(Number),
        }),
      })
    );
    expect(results[0].rankingSignals?.fieldScores.title).toBeGreaterThan(0);
  });

  it("includes evidence snippets and normalized shares in ranking explanations", async () => {
    const engine = new FlexSearchEngine();
    await engine.build(
      [document("evidence", "memory systems", "source lifecycle evidence for memory systems")],
      new Map()
    );

    const results = await engine.search({
      query: "memory systems",
      limit: 1,
      rerank: false,
      rankingMode: "rrf",
      explain: true,
    });

    expect(results[0].rankingSignals).toEqual(
      expect.objectContaining({
        matchedFields: expect.arrayContaining(["title", "transcript"]),
        normalizedFieldScores: expect.objectContaining({
          title: expect.any(Number),
          transcript: expect.any(Number),
        }),
        evidence: expect.arrayContaining([
          expect.objectContaining({
            field: "title",
            snippet: expect.stringContaining("memory systems"),
          }),
          expect.objectContaining({
            field: "transcript",
            snippet: expect.stringContaining("source lifecycle"),
          }),
        ]),
      })
    );
  });
});
