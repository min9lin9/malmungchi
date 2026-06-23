import { describe, expect, it } from "bun:test";
import { formatCorpusStats, formatDocument, formatSearchResults } from "../src/mcp/formatters";

describe("mcp formatters", () => {
  it("formats search results with total and offset", () => {
    const text = formatSearchResults(
      "product",
      [
        {
          slug: "brian-chesky",
          title: "Brian Chesky",
          guest: "Brian Chesky",
          publishDate: "2023-01-01",
          topicSlugs: ["product-management"],
          score: 0.95,
          snippet: "We talked about product management.",
          sourceType: "author",
          sourceId: "author:demo",
          rankingMode: "weighted",
          rankingSignals: {
            matchedFields: ["title", "transcript"],
            fieldScores: { title: 4, transcript: 1 },
            rawScore: 5,
            normalizedScore: 0.95,
            rankingMode: "weighted",
          },
        },
      ],
      10_000,
      5,
      0,
      10
    );
    expect(text).toContain('Search Results: "product"');
    expect(text).toContain("Showing 1–1 of 5 matches");
    expect(text).toContain("Brian Chesky");
    expect(text).toContain("0.95");
    expect(text).toContain("Normalized score: 0.95");
    expect(text).toContain("Field scores: title=4.00, transcript=1.00");
  });

  it("formats search explanation evidence when ranking signals are present", () => {
    const text = formatSearchResults(
      "memory",
      [
        {
          slug: "author:demo:memory",
          title: "Memory",
          guest: "Host",
          topicSlugs: [],
          score: 0.95,
          snippet: "Memory evidence.",
          sourceType: "author",
          sourceId: "author:demo",
          rankingMode: "rrf",
          rankingSignals: {
            matchedFields: ["title", "transcript"],
            fieldScores: { title: 0.8, transcript: 0.2 },
            rawScore: 1,
            normalizedScore: 0.95,
            rankingMode: "rrf",
            normalizedFieldScores: { title: 0.8, transcript: 0.2 },
            evidence: [
              { field: "title", snippet: "Memory" },
              { field: "transcript", snippet: "Memory evidence." },
            ],
            rerank: { attempted: true, applied: true },
          },
        },
      ],
      10_000
    );

    expect(text).toContain("Raw score: 1.00");
    expect(text).toContain("Normalized score: 0.95");
    expect(text).toContain("Field scores: title=0.80, transcript=0.20");
    expect(text).toContain("Field score shares: title=0.80, transcript=0.20");
    expect(text).toContain("Evidence:");
    expect(text).toContain("title: Memory");
    expect(text).toContain("Rerank: applied");
  });

  it("truncates search results when exceeding maxChars", () => {
    const text = formatSearchResults(
      "product",
      [
        {
          slug: "brian-chesky",
          title: "Brian Chesky",
          guest: "Brian Chesky",
          publishDate: "2023-01-01",
          topicSlugs: ["product-management"],
          score: 0.95,
          snippet: "We talked about product management.",
          sourceType: "author",
          sourceId: "author:demo",
          rankingMode: "weighted",
        },
      ],
      50,
      5,
      0,
      10
    );
    expect(text).toContain("...(truncated)");
  });

  it("formats document with truncation", () => {
    const text = formatDocument("author:demo:note", "metadata", "Long content", 40);
    expect(text).toContain("Document: author:demo:note");
    expect(text).toContain("...(truncated)");
  });

  it("formats corpus stats", () => {
    const text = formatCorpusStats({
      name: "test",
      generatedAt: "2024-01-01T00:00:00Z",
      episodeCount: 10,
      topicCount: 5,
      indexedEpisodeCount: 10,
      transcriptBytes: 1234,
      transcriptWordCount: 567,
      schemaVersion: 1,
      episodeSlugs: [],
      topicSlugs: [],
      episodeHashes: {},
      topicHashes: {},
    });
    expect(text).toContain("Corpus Stats: test");
    expect(text).toContain("1,234");
  });
});
