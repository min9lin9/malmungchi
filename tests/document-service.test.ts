import { describe, expect, it } from "bun:test";
import { DocumentNotFoundError } from "../src/domain/errors";
import { buildFixtureDocumentService } from "./helpers/build-fixture-service";

describe("document service", () => {
  it("returns stats", async () => {
    const service = await buildFixtureDocumentService();
    const stats = service.getStats();
    expect(stats.documentCount).toBe(2);
    expect(stats.categoryCount).toBe(0);
  });

  it("searches documents", async () => {
    const service = await buildFixtureDocumentService();
    const result = await service.searchDocuments({
      query: "product",
      limit: 5,
    });
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.length).toBeLessThanOrEqual(5);
    expect(result.total).toBeGreaterThanOrEqual(result.results.length);
  });

  it("gets document metadata by slug", async () => {
    const service = await buildFixtureDocumentService();
    const result = service.getDocument({
      slug: "author:demo-author:product-note",
      section: "metadata",
    });
    expect(result.slug).toBe("author:demo-author:product-note");
    expect(result.section).toBe("metadata");
    expect(result.content).toContain("Product Note");
  });

  it("gets document by legacy author name", async () => {
    const service = await buildFixtureDocumentService();
    const result = service.getDocument({ guestName: "demo-author", section: "metadata" });
    expect(result.slug.startsWith("author:demo-author:")).toBe(true);
  });

  it("throws for missing document", async () => {
    const service = await buildFixtureDocumentService();
    expect(() => service.getDocument({ slug: "not-real-guest", section: "metadata" })).toThrow(
      DocumentNotFoundError
    );
  });
});
