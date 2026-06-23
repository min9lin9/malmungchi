import { describe, expect, it } from "bun:test";
import { buildFixtureEngine } from "./helpers/build-fixture-engine";

async function search(engine: Awaited<ReturnType<typeof buildFixtureEngine>>, query: string) {
  return engine.searchWithTotal({ query, limit: 10 });
}

describe("FlexSearchEngine mutations", () => {
  it("addDocuments makes new documents searchable", async () => {
    const engine = await buildFixtureEngine();
    const before = await search(engine, "xyznewterm");
    expect(before.total).toBe(0);

    await engine.addDocuments([
      {
        slug: "new-document",
        metadata: {
          title: "New DocumentRecord",
          guest: "Guest",
          publish_date: "2024-01-01",
          keywords: ["xyznewterm"],
        },
        content: "",
        transcript: "We discussed xyznewterm.",
        wordCount: 5,
      } as unknown as import("../src/domain/document").DocumentRecord,
    ]);

    const after = await search(engine, "xyznewterm");
    expect(after.total).toBe(1);
    expect(after.results[0].slug).toBe("new-document");
  });

  it("removeDocuments makes documents unsearchable", async () => {
    const engine = await buildFixtureEngine();
    const before = await search(engine, "product");
    expect(before.total).toBeGreaterThan(0);

    const slugToRemove = before.results[0].slug;
    await engine.removeDocuments([slugToRemove]);

    const after = await search(engine, "product");
    expect(after.results.every((r) => r.slug !== slugToRemove)).toBe(true);
    expect(engine.getStats().indexedCount).toBeLessThan(before.total + 1);
  });
});
