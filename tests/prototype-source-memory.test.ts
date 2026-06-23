import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { buildService } from "../src/bootstrap";
import { createHttpApp } from "../src/http/app";
import { compactSourceMemoryFile } from "../src/source/source-memory-compaction";
import { importPrototypeAuthor, makePrototypeDataDir } from "./prototype-source-test-helpers";

describe("prototype source memory polish", () => {
  it("compacts source memory over HTTP", async () => {
    const dataDir = await makePrototypeDataDir("prototype-compact-");
    try {
      const app = createHttpApp(await buildService(dataDir, "test-malmunchi"));
      await importPrototypeAuthor(app, "compact-author");

      for (let index = 0; index < 3; index++) {
        const refresh = await app.handle(
          new Request("http://localhost/malmunchi/sources/author:compact-author/refresh", {
            method: "POST",
          })
        );
        expect(refresh.status).toBe(200);
      }
      await fs.appendFile(path.join(dataDir, ".cache", "source-memory.jsonl"), "{bad-json\n");

      const compact = await app.handle(
        new Request("http://localhost/malmunchi/sources/author:compact-author/memory/compact", {
          method: "POST",
        })
      );
      expect(compact.status).toBe(200);
      const compactBody = (await compact.json()) as {
        sourceId: string;
        compacted: boolean;
        retainedEvents: number;
        skippedMalformedEvents: number;
        backupId: string;
        backupRetained: boolean;
      };
      expect(compactBody).toEqual(
        expect.objectContaining({
          sourceId: "author:compact-author",
          compacted: true,
          retainedEvents: 4,
          skippedMalformedEvents: 1,
          backupId: expect.stringMatching(/^source-memory\.jsonl\..+\.bak$/),
          backupRetained: true,
        })
      );

      const status = await app.handle(
        new Request("http://localhost/malmunchi/sources/author:compact-author/status")
      );
      expect(status.status).toBe(200);
      const statusBody = (await status.json()) as {
        memory: {
          compacted: boolean;
          lastCompactedAt?: string;
          skippedMalformedEvents?: number;
          backupRetained?: boolean;
        };
      };
      expect(statusBody.memory.compacted).toBe(true);
      expect(statusBody.memory.lastCompactedAt).toBeDefined();
      expect(statusBody.memory.skippedMalformedEvents).toBe(1);
      expect(statusBody.memory.backupRetained).toBe(true);

      const history = await app.handle(
        new Request("http://localhost/malmunchi/sources/author:compact-author/history")
      );
      const historyBody = (await history.json()) as {
        events: { readonly action: string }[];
        lastCompaction?: { readonly sourceId: string; readonly skippedMalformedEvents: number };
      };
      expect(historyBody.events.map((event) => event.action)).toEqual([
        "import",
        "refresh",
        "refresh",
        "refresh",
      ]);
      expect(historyBody.lastCompaction).toEqual(
        expect.objectContaining({
          sourceId: "author:compact-author",
          skippedMalformedEvents: 1,
        })
      );
      const cacheDir = path.join(dataDir, ".cache");
      const firstBackups = (await fs.readdir(cacheDir)).filter((name) => name.endsWith(".bak"));
      expect(firstBackups).toHaveLength(1);

      const secondCompact = await app.handle(
        new Request("http://localhost/malmunchi/sources/author:compact-author/memory/compact", {
          method: "POST",
        })
      );
      expect(secondCompact.status).toBe(200);
      const secondBackups = (await fs.readdir(cacheDir)).filter((name) => name.endsWith(".bak"));
      expect(secondBackups).toHaveLength(1);

      const deleteRes = await app.handle(
        new Request("http://localhost/malmunchi/sources/author:compact-author", {
          method: "DELETE",
        })
      );
      expect(deleteRes.status).toBe(200);
      const deletedCompact = await app.handle(
        new Request("http://localhost/malmunchi/sources/author:compact-author/memory/compact", {
          method: "POST",
        })
      );
      expect(deletedCompact.status).toBe(200);

      const beforeUnknown = await fs.readFile(path.join(dataDir, ".cache", "source-memory.jsonl"));
      const unknownCompact = await app.handle(
        new Request("http://localhost/malmunchi/sources/author:not-real/memory/compact", {
          method: "POST",
        })
      );
      expect(unknownCompact.status).toBeGreaterThanOrEqual(400);
      const afterUnknown = await fs.readFile(path.join(dataDir, ".cache", "source-memory.jsonl"));
      expect(afterUnknown.equals(beforeUnknown)).toBe(true);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  it("does not overwrite a corrupt compaction sidecar", async () => {
    const dataDir = await makePrototypeDataDir("prototype-compact-sidecar-");
    try {
      const app = createHttpApp(await buildService(dataDir, "test-malmunchi"));
      await importPrototypeAuthor(app, "sidecar-author");
      await fs.mkdir(path.join(dataDir, ".cache"), { recursive: true });
      const sidecarPath = path.join(dataDir, ".cache", "source-memory.compaction.json");
      await fs.writeFile(sidecarPath, "{bad-json", "utf-8");

      const compact = await app.handle(
        new Request("http://localhost/malmunchi/sources/author:sidecar-author/memory/compact", {
          method: "POST",
        })
      );

      expect(compact.status).toBe(500);
      const sidecar = await fs.readFile(sidecarPath, "utf-8");
      expect(sidecar).toBe("{bad-json");
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  it("serializes concurrent source memory compactions", async () => {
    const dataDir = await makePrototypeDataDir("prototype-compact-lock-");
    try {
      const memoryPath = path.join(dataDir, ".cache", "source-memory.jsonl");
      const sourceId = "author:lock-author";
      const events = Array.from({ length: 30 }, (_, index) => ({
        sourceId,
        action: "refresh",
        at: new Date(index * 1000).toISOString(),
        documentCount: 1,
      }));
      await fs.mkdir(path.dirname(memoryPath), { recursive: true });
      await fs.writeFile(
        memoryPath,
        `${events.map((event) => JSON.stringify(event)).join("\n")}\n{bad-json\n`,
        "utf-8"
      );

      await Promise.all(
        Array.from({ length: 3 }, () =>
          compactSourceMemoryFile({ filePath: memoryPath, sourceId, keepLastPerSource: 5 })
        )
      );

      const lines = (await fs.readFile(memoryPath, "utf-8")).trim().split("\n");
      const compactedEvents = lines.map((line) => JSON.parse(line)) as Array<{
        sourceId: string;
      }>;
      expect(compactedEvents).toHaveLength(5);
      expect(compactedEvents.every((event) => event.sourceId === sourceId)).toBe(true);

      const sidecar = JSON.parse(
        await fs.readFile(path.join(dataDir, ".cache", "source-memory.compaction.json"), "utf-8")
      ) as { latestBySource: Record<string, { retainedEvents: number }> };
      expect(sidecar.latestBySource[sourceId]?.retainedEvents).toBe(5);

      const backups = (await fs.readdir(path.dirname(memoryPath))).filter((name) =>
        name.endsWith(".bak")
      );
      expect(backups).toHaveLength(1);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  it("recovers stale compaction locks", async () => {
    const dataDir = await makePrototypeDataDir("prototype-compact-stale-lock-");
    try {
      const memoryPath = path.join(dataDir, ".cache", "source-memory.jsonl");
      const sourceId = "author:stale-lock";
      await fs.mkdir(path.dirname(memoryPath), { recursive: true });
      await fs.writeFile(
        memoryPath,
        `${JSON.stringify({
          sourceId,
          action: "refresh",
          at: new Date(0).toISOString(),
          documentCount: 1,
        })}\n`,
        "utf-8"
      );
      const lockPath = `${memoryPath}.lock`;
      await fs.writeFile(
        lockPath,
        JSON.stringify({
          pid: 99999999,
          acquiredAt: new Date(0).toISOString(),
          target: path.basename(memoryPath),
        }),
        "utf-8"
      );
      const oldTime = new Date(Date.now() - 60_000);
      await fs.utimes(lockPath, oldTime, oldTime);

      const result = await compactSourceMemoryFile({
        filePath: memoryPath,
        sourceId,
        keepLastPerSource: 1,
      });

      expect(result.compacted).toBe(true);
      const lockStillExists = await fs
        .access(lockPath)
        .then(() => true)
        .catch(() => false);
      expect(lockStillExists).toBe(false);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });
});
