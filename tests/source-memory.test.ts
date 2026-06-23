import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SourceMemory } from "../src/source/source-memory";

describe("SourceMemory", () => {
  it("reports malformed JSONL records without dropping valid source events", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "source-memory-"));
    const memoryPath = path.join(dir, "source-memory.jsonl");
    await fs.writeFile(
      memoryPath,
      [
        JSON.stringify({
          sourceId: "author:demo",
          action: "import",
          at: "2026-01-01T00:00:00.000Z",
          documentCount: 1,
        }),
        "{bad json}",
        JSON.stringify({
          sourceId: "author:demo",
          action: "refresh",
          at: "2026-01-02T00:00:00.000Z",
          documentCount: 1,
        }),
        "",
      ].join("\n"),
      "utf-8"
    );
    const memory = new SourceMemory(memoryPath);

    const read = await memory.readEvents({ sourceId: "author:demo", limit: 1, offset: 1 });

    expect(read.totalEvents).toBe(2);
    expect(read.skippedMalformedEvents).toBe(1);
    expect(read.events.map((event) => event.action)).toEqual(["refresh"]);

    const countsOnly = await memory.readEvents({ sourceId: "author:demo", limit: 0 });
    expect(countsOnly.totalEvents).toBe(2);
    expect(countsOnly.limit).toBe(0);
    expect(countsOnly.events).toEqual([]);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
