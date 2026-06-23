import { describe, expect, it } from "bun:test";
import { EpisodeNotFoundError } from "../src/domain/errors";
import { buildFixturePodcastService } from "./helpers/build-fixture-service";

describe("podcast service", () => {
  it("returns stats", async () => {
    const service = await buildFixturePodcastService();
    const stats = service.getStats();
    expect(stats.episodeCount).toBe(2);
    expect(stats.topicCount).toBe(0);
  });

  it("searches documents", async () => {
    const service = await buildFixturePodcastService();
    const result = await service.searchDocuments({
      query: "product",
      limit: 5,
    });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.length).toBeLessThanOrEqual(5);
    expect(result.total).toBeGreaterThanOrEqual(result.results.length);
  });

  it("gets document metadata by slug", async () => {
    const service = await buildFixturePodcastService();
    const result = service.getEpisode({
      slug: "author:demo-author:product-note",
      section: "metadata",
    });
    expect(result.slug).toBe("author:demo-author:product-note");
    expect(result.section).toBe("metadata");
    expect(result.content).toContain("Product Note");
  });

  it("gets document by legacy author name", async () => {
    const service = await buildFixturePodcastService();
    const result = service.getEpisode({ guestName: "demo-author", section: "metadata" });
    expect(result.slug.startsWith("author:demo-author:")).toBe(true);
  });

  it("throws for missing document", async () => {
    const service = await buildFixturePodcastService();
    expect(() => service.getEpisode({ slug: "not-real-guest", section: "metadata" })).toThrow(
      EpisodeNotFoundError
    );
  });
});
