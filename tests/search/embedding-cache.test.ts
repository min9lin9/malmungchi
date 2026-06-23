import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EmbeddingCache } from "../../src/search/rerank/embedding-cache";

describe("embedding cache", () => {
  it("stores embeddings under first two chars of slug and invalidates by cache key", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "embedding-cache-test-"));
    const cache = new EmbeddingCache(dir);

    await cache.save({
      slug: "author:demo:first",
      contentHash: "hash-1",
      provider: "openai",
      model: "text-embedding-3-small",
      dimension: 2,
      embedding: [1, 0],
    });

    const key = {
      slug: "author:demo:first",
      contentHash: "hash-1",
      provider: "openai",
      model: "text-embedding-3-small",
      dimension: 2,
    };
    expect(await cache.load(key)).toEqual([1, 0]);
    expect(await cache.load({ ...key, contentHash: "hash-2" })).toBeNull();
    expect(await cache.load({ ...key, model: "text-embedding-3-large" })).toBeNull();
    const expectedPath = path.join(dir, "au", "author%3Ademo%3Afirst.json");
    expect(await fs.stat(expectedPath)).toBeTruthy();

    await fs.rm(dir, { recursive: true, force: true });
  });
});
