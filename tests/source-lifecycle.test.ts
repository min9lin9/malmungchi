import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildService } from "../src/bootstrap";
import { createHttpApp } from "../src/http/app";

async function makeDataDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "source-lifecycle-"));
  await fs.mkdir(path.join(dir, "episodes"), { recursive: true });
  await fs.mkdir(path.join(dir, "topics"), { recursive: true });
  await fs.mkdir(path.join(dir, "imports"), { recursive: true });
  return dir;
}

describe("source lifecycle", () => {
  it("rejects malformed source id export", async () => {
    const dataDir = await makeDataDir();
    const service = await buildService(dataDir, "test-corpus");
    const app = createHttpApp(service);

    const exportRes = await app.handle(
      new Request("http://localhost/corpus/sources/not-valid/export")
    );

    expect(exportRes.status).toBe(400);
  });

  it("lists, inspects, and deletes an imported author source", async () => {
    const dataDir = await makeDataDir();
    const service = await buildService(dataDir, "test-corpus");
    const app = createHttpApp(service);

    const importRes = await app.handle(
      new Request("http://localhost/corpus/import-author", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileContent: "# Source Lifecycle\n\nRepeatable source management notes.",
          fileName: "source.md",
          authorId: "demo-author",
        }),
      })
    );
    expect(importRes.status).toBe(200);

    const listRes = await app.handle(new Request("http://localhost/corpus/sources"));
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as {
      sources: Array<{
        id: string;
        type: string;
        documentCount: number;
        interactionCount: number;
        lastAction?: string;
      }>;
    };
    expect(listBody.sources).toContainEqual(
      expect.objectContaining({
        id: "author:demo-author",
        type: "author",
        documentCount: 1,
        interactionCount: 1,
        lastAction: "import",
      })
    );

    const detailRes = await app.handle(
      new Request("http://localhost/corpus/sources/author:demo-author")
    );
    expect(detailRes.status).toBe(200);
    const detailBody = (await detailRes.json()) as {
      source: { id: string };
      documents: Array<{ slug: string; title: string }>;
    };
    expect(detailBody.source.id).toBe("author:demo-author");
    expect(detailBody.documents).toEqual([
      { slug: "author:demo-author:source-lifecycle", title: "Source Lifecycle" },
    ]);

    const refreshRes = await app.handle(
      new Request("http://localhost/corpus/sources/author:demo-author/refresh", {
        method: "POST",
      })
    );
    expect(refreshRes.status).toBe(200);
    const refreshBody = (await refreshRes.json()) as {
      sourceId: string;
      status: string;
      refreshedDocuments: number;
      skipped: number;
      changes: {
        skippedSlugs: string[];
      };
    };
    expect(refreshBody).toEqual(
      expect.objectContaining({
        sourceId: "author:demo-author",
        status: "unchanged",
        refreshedDocuments: 1,
        skipped: 1,
      })
    );
    expect(refreshBody.changes.skippedSlugs).toEqual(["author:demo-author:source-lifecycle"]);

    const storedPost = path.join(
      dataDir,
      "authors",
      "demo-author",
      "posts",
      "source-lifecycle",
      "post.md"
    );
    const storedContent = await fs.readFile(storedPost, "utf-8");
    await fs.writeFile(
      storedPost,
      storedContent
        .replace(/"content_hash": "[^"]+"/u, '"content_hash": "manual-refresh-hash"')
        .replace("Repeatable source management notes.", "Updated source management notes."),
      "utf-8"
    );

    const changedRefreshRes = await app.handle(
      new Request("http://localhost/corpus/sources/author:demo-author/refresh", {
        method: "POST",
      })
    );
    expect(changedRefreshRes.status).toBe(200);
    const changedRefreshBody = (await changedRefreshRes.json()) as {
      status: string;
      updated: number;
      changes: {
        updatedSlugs: string[];
      };
    };
    expect(changedRefreshBody.status).toBe("changed");
    expect(changedRefreshBody.updated).toBe(1);
    expect(changedRefreshBody.changes.updatedSlugs).toEqual([
      "author:demo-author:source-lifecycle",
    ]);

    const exportRes = await app.handle(
      new Request(
        "http://localhost/corpus/sources/author:demo-author/export?format=json&includeHistory=true"
      )
    );
    expect(exportRes.status).toBe(200);
    const exportBody = (await exportRes.json()) as {
      source: { id: string };
      manifest: {
        version: number;
        sourceId: string;
        documentCount: number;
        contentBytes: number;
        historyIncluded: boolean;
      };
      documents: Array<{
        slug: string;
        content: string;
        sourceId: string;
        provenance: { sourceId: string };
      }>;
      history: { events: Array<{ action: string }> };
    };
    expect(exportBody.source.id).toBe("author:demo-author");
    expect(exportBody.manifest).toEqual(
      expect.objectContaining({
        version: 1,
        sourceId: "author:demo-author",
        documentCount: 1,
        historyIncluded: true,
      })
    );
    expect(exportBody.manifest.contentBytes).toBeGreaterThan(0);
    expect(exportBody.documents[0]).toEqual(
      expect.objectContaining({
        slug: "author:demo-author:source-lifecycle",
        content: expect.stringContaining("Updated source management notes."),
        sourceId: "author:demo-author",
        provenance: expect.objectContaining({
          sourceId: "author:demo-author",
        }),
      })
    );
    expect(exportBody.history.events.map((event) => event.action)).toEqual([
      "import",
      "refresh",
      "refresh",
    ]);

    await fs.appendFile(
      path.join(dataDir, ".cache", "source-memory.jsonl"),
      "{not valid json}\n",
      "utf-8"
    );
    const historyRes = await app.handle(
      new Request("http://localhost/corpus/sources/author:demo-author/history?limit=2&offset=1")
    );
    expect(historyRes.status).toBe(200);
    const historyBody = (await historyRes.json()) as {
      totalEvents: number;
      offset: number;
      limit: number;
      skippedMalformedEvents: number;
      events: Array<{ action: string }>;
    };
    expect(historyBody.totalEvents).toBe(3);
    expect(historyBody.offset).toBe(1);
    expect(historyBody.limit).toBe(2);
    expect(historyBody.skippedMalformedEvents).toBe(1);
    expect(historyBody.events.map((event) => event.action)).toEqual(["refresh", "refresh"]);

    const deleteRes = await app.handle(
      new Request("http://localhost/corpus/sources/author:demo-author", {
        method: "DELETE",
      })
    );
    expect(deleteRes.status).toBe(200);
    const deleteBody = (await deleteRes.json()) as { deletedDocuments: number };
    expect(deleteBody.deletedDocuments).toBe(1);

    const searchRes = await app.handle(
      new Request("http://localhost/search?q=repeatable%20source&rerank=false")
    );
    const searchBody = (await searchRes.json()) as { returned: number };
    expect(searchBody.returned).toBe(0);

    const listAfterDelete = await app.handle(new Request("http://localhost/corpus/sources"));
    const afterBody = (await listAfterDelete.json()) as {
      sources: Array<{ id: string; lastAction?: string }>;
    };
    expect(afterBody.sources).not.toContainEqual(
      expect.objectContaining({ id: "author:demo-author" })
    );

    const historyAfterDeleteRes = await app.handle(
      new Request("http://localhost/corpus/sources/author:demo-author/history")
    );
    const historyAfterDeleteBody = (await historyAfterDeleteRes.json()) as {
      totalEvents: number;
      skippedMalformedEvents: number;
      events: Array<{ action: string }>;
    };
    expect(historyAfterDeleteBody.totalEvents).toBe(4);
    expect(historyAfterDeleteBody.skippedMalformedEvents).toBe(1);
    expect(historyAfterDeleteBody.events.map((event) => event.action)).toEqual([
      "import",
      "refresh",
      "refresh",
      "delete",
    ]);

    await fs.rm(dataDir, { recursive: true, force: true });
  });
});
