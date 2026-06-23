import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  importAuthorFile,
  importAuthorText,
  loadAllAuthorPosts,
} from "../../src/author/storage/author-storage";

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "author-storage-test-"));
}

describe("author storage", () => {
  it("imports markdown headings as author posts", async () => {
    const dir = await makeTempDir();
    const source = path.join(dir, "source.md");
    await fs.writeFile(
      source,
      "# First Essay\n\nAlpha product strategy.\n\n## Second Essay\n\nBeta leadership notes.",
      "utf-8"
    );

    const result = await importAuthorFile({
      filePath: source,
      authorId: "demo-author",
      authorsDir: path.join(dir, "authors"),
    });

    expect(result.posts.map((post) => post.slug)).toEqual([
      "author:demo-author:first-essay",
      "author:demo-author:second-essay",
    ]);

    const loaded = await loadAllAuthorPosts(path.join(dir, "authors"));
    expect(loaded).toHaveLength(2);
    expect(loaded[0].authorId).toBe("demo-author");
    expect(loaded[0].contentHash).toBeTruthy();

    await fs.rm(dir, { recursive: true, force: true });
  });

  it("requires a toc key when importing JSONL", async () => {
    const dir = await makeTempDir();
    await expect(
      importAuthorText({
        content: JSON.stringify({ title: "No Chapter", content: "Missing toc key" }),
        fileName: "pages.jsonl",
        authorId: "source-author",
        authorsDir: path.join(dir, "authors"),
      })
    ).rejects.toThrow("tocKey");

    await fs.rm(dir, { recursive: true, force: true });
  });

  it("splits oversized markdown sections through the LLM splitter fallback", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "author-storage-large-"));
    const content = `# Big Section\n\n${Array.from({ length: 8005 }, (_, index) => `word${index}`).join(" ")}`;

    const result = await importAuthorText({
      content,
      fileName: "big.md",
      authorId: "demo-author",
      authorsDir: dir,
    });

    expect(result.posts.length).toBe(2);
    expect(result.posts[0].title).toBe("Big Section");
    expect(result.posts[1].title).toBe("Big Section 2");

    await fs.rm(dir, { recursive: true, force: true });
  });

  it("disambiguates duplicate markdown section titles", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "author-storage-dupe-"));

    const result = await importAuthorText({
      content: "# Same Title\n\nfirst\n\n# Same-Title\n\nsecond",
      fileName: "dupe.md",
      authorId: "demo-author",
      authorsDir: dir,
    });

    expect(result.posts.map((post) => post.documentSlug)).toEqual(["same-title", "same-title-2"]);

    await fs.rm(dir, { recursive: true, force: true });
  });
});
