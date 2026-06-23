import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildService } from "../src/bootstrap";
import { createHttpApp } from "../src/http/app";

async function makeDataDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "http-author-test-"));
  await fs.mkdir(path.join(dir, "documents"), { recursive: true });
  await fs.mkdir(path.join(dir, "categories"), { recursive: true });
  await fs.mkdir(path.join(dir, "imports"), { recursive: true });
  return dir;
}

describe("author and llm http routes", () => {
  it("POST /malmunchi/import-author imports a local markdown source", async () => {
    const dataDir = await makeDataDir();
    const source = path.join(dataDir, "imports", "source.md");
    await fs.writeFile(source, "# Imported Essay\n\nSemantic search notes.", "utf-8");
    const service = await buildService(dataDir, "test-malmunchi");
    const app = createHttpApp(service);

    const res = await app.handle(
      new Request("http://localhost/malmunchi/import-author", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filePath: source, authorId: "demo-author" }),
      })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { authorId: string; importedPosts: number };
    expect(body.authorId).toBe("demo-author");
    expect(body.importedPosts).toBe(1);

    const search = await app.handle(new Request("http://localhost/search?q=semantic&rerank=false"));
    expect(search.status).toBe(200);
    const searchBody = (await search.json()) as { results: Array<{ slug: string }> };
    expect(searchBody.results[0].slug).toBe("author:demo-author:imported-essay");

    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("POST /malmunchi/import-author rejects server-local paths outside the import directory", async () => {
    const dataDir = await makeDataDir();
    const outside = path.join(dataDir, "outside.md");
    await fs.writeFile(outside, "# Outside\n\nShould not import.", "utf-8");
    const service = await buildService(dataDir, "test-malmunchi");
    const app = createHttpApp(service);

    const res = await app.handle(
      new Request("http://localhost/malmunchi/import-author", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filePath: outside, authorId: "demo-author" }),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);

    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("GET /llm/status returns sanitized embedding configuration", async () => {
    const dataDir = await makeDataDir();
    const service = await buildService(dataDir, "test-malmunchi");
    const app = createHttpApp(service);

    const res = await app.handle(new Request("http://localhost/llm/status"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { provider: string; model: string; authenticated: boolean };
    expect(body.provider).toBe("openai");
    expect(body.model).toBe("text-embedding-3-small");
    expect(body.authenticated).toBe(false);

    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("POST /malmunchi/import-author rejects invalid author IDs", async () => {
    const dataDir = await makeDataDir();
    const service = await buildService(dataDir, "test-malmunchi");
    const app = createHttpApp(service);

    const res = await app.handle(
      new Request("http://localhost/malmunchi/import-author", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileContent: "# Essay\n\nBody",
          fileName: "essay.md",
          authorId: "Demo Author",
        }),
      })
    );

    expect(res.status).toBeGreaterThanOrEqual(400);

    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("POST /malmunchi/import-author updates manifest counts for changed posts", async () => {
    const dataDir = await makeDataDir();
    const service = await buildService(dataDir, "test-malmunchi");
    const app = createHttpApp(service);

    async function importContent(content: string) {
      const res = await app.handle(
        new Request("http://localhost/malmunchi/import-author", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fileContent: content,
            fileName: "essay.md",
            authorId: "demo-author",
          }),
        })
      );
      return (await res.json()) as { updatedPosts: number };
    }

    await importContent("# Stable Essay\n\nshort body");
    const firstCount = service.getStats().contentWordCount;
    const second = await importContent("# Stable Essay\n\nshort body with many additional words");

    expect(second.updatedPosts).toBe(1);
    expect(service.getStats().contentWordCount).toBeGreaterThan(firstCount);
    expect(service.getStats().documentHashes["author:demo-author:stable-essay"]).toBeTruthy();

    await fs.rm(dataDir, { recursive: true, force: true });
  });
});
