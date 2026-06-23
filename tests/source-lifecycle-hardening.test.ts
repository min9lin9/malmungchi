import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildService } from "../src/bootstrap";
import { createHttpApp } from "../src/http/app";

async function makeDataDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "source-lifecycle-hardening-"));
  await fs.mkdir(path.join(dir, "documents"), { recursive: true });
  await fs.mkdir(path.join(dir, "categories"), { recursive: true });
  await fs.mkdir(path.join(dir, "imports"), { recursive: true });
  return dir;
}

describe("source lifecycle hardening", () => {
  it("reports source status, refresh document changes, export bundles, and paginated history", async () => {
    const dataDir = await makeDataDir();
    const service = await buildService(dataDir, "test-malmungchi");
    const app = createHttpApp(service);

    const importRes = await app.handle(
      new Request("http://localhost/malmungchi/import-author", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileContent: "# Memory UX\n\nFirst durable memory note.",
          fileName: "memory.md",
          authorId: "memory-author",
        }),
      })
    );
    expect(importRes.status).toBe(200);

    const statusRes = await app.handle(
      new Request("http://localhost/malmungchi/sources/author:memory-author/status")
    );
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as {
      sourceId: string;
      exists: boolean;
      activeDocumentCount: number;
      memory: { eventCount: number; malformedEventCount: number; compacted: boolean };
    };
    expect(statusBody).toEqual(
      expect.objectContaining({
        sourceId: "author:memory-author",
        exists: true,
        activeDocumentCount: 1,
        memory: expect.objectContaining({
          eventCount: 1,
          malformedEventCount: 0,
          compacted: false,
        }),
      })
    );

    const postPath = path.join(
      dataDir,
      "authors",
      "memory-author",
      "posts",
      "memory-ux",
      "post.md"
    );
    const stored = await fs.readFile(postPath, "utf-8");
    await fs.writeFile(
      postPath,
      stored
        .replace('"content_hash":', '"content_hash": "changed-memory-hash", "old_hash":')
        .replace("First durable memory note.", "Updated durable memory note."),
      "utf-8"
    );

    const refreshRes = await app.handle(
      new Request("http://localhost/malmungchi/sources/author:memory-author/refresh", {
        method: "POST",
      })
    );
    expect(refreshRes.status).toBe(200);
    const refreshBody = (await refreshRes.json()) as {
      updated: number;
      updatedSlugs: string[];
      status: string;
      changedDocuments: number;
      changes: {
        updatedSlugs: string[];
        documents: Array<{ slug: string; action: string; title: string }>;
      };
    };
    expect(refreshBody.updated).toBe(1);
    expect(refreshBody.status).toBe("changed");
    expect(refreshBody.changedDocuments).toBe(1);
    expect(refreshBody.updatedSlugs).toEqual(["author:memory-author:memory-ux"]);
    expect(refreshBody.changes.updatedSlugs).toEqual(["author:memory-author:memory-ux"]);
    expect(refreshBody.changes.documents).toContainEqual(
      expect.objectContaining({
        slug: "author:memory-author:memory-ux",
        action: "updated",
        title: "Memory UX",
      })
    );

    const exportRes = await app.handle(
      new Request(
        "http://localhost/malmungchi/sources/author:memory-author/export?format=markdown&includeHistory=true"
      )
    );
    expect(exportRes.status).toBe(200);
    const exportBody = (await exportRes.json()) as {
      format: string;
      manifest: { sourceId: string; documentCount: number; contentBytes: number };
      markdown: string;
      history: { events: Array<{ action: string }> };
    };
    expect(exportBody.format).toBe("markdown");
    expect(exportBody.manifest).toEqual(
      expect.objectContaining({
        sourceId: "author:memory-author",
        documentCount: 1,
        contentBytes: expect.any(Number),
      })
    );
    expect(exportBody.markdown).toContain("# Exported Source: author:memory-author");
    expect(exportBody.markdown).toContain("Updated durable memory note.");
    expect(exportBody.history.events.map((event) => event.action)).toEqual(["import", "refresh"]);

    const historyRes = await app.handle(
      new Request(
        "http://localhost/malmungchi/sources/author:memory-author/history?offset=1&limit=1"
      )
    );
    expect(historyRes.status).toBe(200);
    const historyBody = (await historyRes.json()) as {
      total: number;
      totalEvents: number;
      offset: number;
      limit: number;
      events: Array<{ action: string }>;
    };
    expect(historyBody).toEqual(
      expect.objectContaining({ total: 2, totalEvents: 2, offset: 1, limit: 1 })
    );
    expect(historyBody.events.map((event) => event.action)).toEqual(["refresh"]);

    await fs.rm(dataDir, { recursive: true, force: true });
  });

  it("keeps valid source memory readable when malformed JSONL events exist", async () => {
    const dataDir = await makeDataDir();
    const service = await buildService(dataDir, "test-malmungchi");
    const app = createHttpApp(service);

    const importRes = await app.handle(
      new Request("http://localhost/malmungchi/import-author", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileContent: "# Corruption\n\nGood event survives.",
          fileName: "corruption.md",
          authorId: "memory-author",
        }),
      })
    );
    expect(importRes.status).toBe(200);
    await fs.appendFile(
      path.join(dataDir, ".cache", "source-memory.jsonl"),
      '{not valid json}\n{"sourceId":"author:memory-author","action":"unknown","at":"now"}\n{"sourceId":123,"action":"import","at":"now","documentCount":1}\n',
      "utf-8"
    );

    const statusRes = await app.handle(
      new Request("http://localhost/malmungchi/sources/author:memory-author/status")
    );
    expect(statusRes.status).toBe(200);
    const statusBody = (await statusRes.json()) as {
      memory: { eventCount: number; malformedEventCount: number };
    };
    expect(statusBody.memory).toEqual(
      expect.objectContaining({ eventCount: 1, malformedEventCount: 3 })
    );

    const historyRes = await app.handle(
      new Request("http://localhost/malmungchi/sources/author:memory-author/history")
    );
    const historyBody = (await historyRes.json()) as {
      events: Array<{ action: string }>;
      malformedEventCount: number;
      skippedMalformedEvents: number;
    };
    expect(historyBody.events.map((event) => event.action)).toEqual(["import"]);
    expect(historyBody.malformedEventCount).toBe(3);
    expect(historyBody.skippedMalformedEvents).toBe(3);

    await fs.rm(dataDir, { recursive: true, force: true });
  });
});
