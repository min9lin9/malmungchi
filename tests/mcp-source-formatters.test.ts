import { describe, expect, it } from "bun:test";
import {
  formatCompactSourceMemoryResult,
  formatExportSourceResult,
  formatRefreshSourceResult,
  formatSourceHistory,
  formatSourceStatus,
} from "../src/mcp/formatters.sources";

describe("mcp source formatters", () => {
  it("formats source status with corruption counts", () => {
    const text = formatSourceStatus({
      sourceId: "author:memory-author",
      exists: true,
      activeDocumentCount: 1,
      memory: {
        eventCount: 2,
        malformedEventCount: 1,
        compacted: false,
        lastAction: "refresh",
        lastSeenAt: "2026-06-16T00:00:00.000Z",
      },
    });

    expect(text).toContain("Source Status: author:memory-author");
    expect(text).toContain("Malformed events: 1");
    expect(text).toContain("Last action: refresh");
  });

  it("formats refresh document changes", () => {
    const text = formatRefreshSourceResult({
      sourceId: "author:memory-author",
      refreshedDocuments: 1,
      added: 0,
      updated: 1,
      skipped: 0,
      addedSlugs: [],
      updatedSlugs: ["author:memory-author:memory-ux"],
      skippedSlugs: [],
      status: "changed",
      changedDocuments: 1,
      failures: [],
      changes: {
        addedSlugs: [],
        updatedSlugs: ["author:memory-author:memory-ux"],
        skippedSlugs: [],
        documents: [
          {
            slug: "author:memory-author:memory-ux",
            title: "Memory UX",
            action: "updated",
            previousHash: "old",
            nextHash: "new",
          },
        ],
      },
    });

    expect(text).toContain("Status: changed");
    expect(text).toContain("Updated slugs: author:memory-author:memory-ux");
    expect(text).toContain("## Document Changes");
    expect(text).toContain("updated: author:memory-author:memory-ux");
  });

  it("formats source export manifest and history diagnostics", () => {
    const exportText = formatExportSourceResult(
      {
        source: {
          id: "author:demo",
          type: "author",
          label: "author:demo",
          documentCount: 1,
          interactionCount: 2,
        },
        manifest: {
          version: 1,
          exportedAt: "2026-01-01T00:00:00.000Z",
          manifestGeneratedAt: "2026-01-01T00:00:00.000Z",
          sourceId: "author:demo",
          sourceType: "author",
          documentCount: 1,
          contentBytes: 12,
          checksumAlgorithm: "sha256",
          documentSetChecksum: "a".repeat(64),
          historyIncluded: false,
          provenanceChecksum: "b".repeat(64),
          bundleChecksum: "c".repeat(64),
        },
        documents: [
          {
            slug: "author:demo:essay",
            title: "Essay",
            content: "Hello world",
            sourceType: "author",
            sourceId: "author:demo",
            checksum: "d".repeat(64),
            checksumAlgorithm: "sha256",
            contentBytes: 11,
            provenance: {
              sourceId: "author:demo",
              sourceType: "author",
              slug: "author:demo:essay",
              title: "Essay",
            },
          },
        ],
      },
      10_000
    );
    expect(exportText).toContain("Manifest version: 1");
    expect(exportText).toContain("Content bytes: 12");

    const historyText = formatSourceHistory({
      sourceId: "author:demo",
      totalEvents: 2,
      offset: 1,
      limit: 1,
      skippedMalformedEvents: 1,
      events: [
        {
          sourceId: "author:demo",
          action: "refresh",
          at: "2026-01-02T00:00:00.000Z",
          documentCount: 1,
        },
      ],
    });
    expect(historyText).toContain("Showing 2-2 of 2 events");
    expect(historyText).toContain("Malformed events skipped: 1");
  });

  it("formats refresh status and affected slugs", () => {
    const text = formatRefreshSourceResult({
      sourceId: "author:demo",
      status: "changed",
      refreshedDocuments: 2,
      added: 0,
      updated: 1,
      skipped: 1,
      addedSlugs: [],
      updatedSlugs: ["author:demo:essay"],
      skippedSlugs: ["author:demo:unchanged"],
      failures: [],
      changes: {
        addedSlugs: [],
        updatedSlugs: ["author:demo:essay"],
        skippedSlugs: ["author:demo:unchanged"],
      },
    });

    expect(text).toContain("- Status: changed");
    expect(text).toContain("- Updated slugs: author:demo:essay");
    expect(text).toContain("- Skipped slugs: author:demo:unchanged");
  });

  it("formats empty source history pages without invalid ranges", () => {
    const empty = formatSourceHistory({
      sourceId: "author:memory-author",
      events: [],
      total: 0,
      offset: 0,
      limit: 100,
      malformedEventCount: 0,
      totalEvents: 0,
      skippedMalformedEvents: 0,
    });
    expect(empty).toContain("Showing 0-0 of 0 events");
    expect(empty).toContain("No source memory events recorded.");

    const emptyPage = formatSourceHistory({
      sourceId: "author:memory-author",
      events: [],
      total: 3,
      offset: 100,
      limit: 100,
      malformedEventCount: 0,
      totalEvents: 3,
      skippedMalformedEvents: 0,
    });
    expect(emptyPage).toContain("Showing 0-0 of 3 events");
    expect(emptyPage).toContain("No source memory events on this page.");

    const impossiblePage = formatSourceHistory({
      sourceId: "author:demo",
      totalEvents: 2,
      offset: 2,
      limit: 1,
      skippedMalformedEvents: 0,
      events: [],
    });
    expect(impossiblePage).toContain("Showing 0-0 of 2 events");
    expect(impossiblePage).toContain("No source memory events on this page.");
  });

  it("formats compaction backup IDs without local paths", () => {
    const text = formatCompactSourceMemoryResult({
      sourceId: "author:demo",
      compacted: true,
      compactedAt: new Date(0).toISOString(),
      retainedEvents: 2,
      removedEvents: 3,
      skippedMalformedEvents: 0,
      backupId: "source-memory.jsonl.123.bak",
      backupRetained: true,
    });

    expect(text).toContain("Backup ID: source-memory.jsonl.123.bak");
    expect(text).not.toContain("/tmp/");
  });
});
