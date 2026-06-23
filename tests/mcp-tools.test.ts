import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildService } from "../src/bootstrap";
import { createMcpServer } from "../src/mcp/server";
import { buildFixtureDocumentService } from "./helpers/build-fixture-service";

async function createTestClient(service: Awaited<ReturnType<typeof buildFixtureDocumentService>>) {
  const server = createMcpServer(service, { maxResponseChars: 50000 });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function textOf(result: unknown): string {
  const content = result && typeof result === "object" && "content" in result ? result.content : [];
  return ((content ?? []) as { type: string; text: string }[]).map((c) => c.text).join("\n");
}

describe("mcp tools", () => {
  it("lists public Malmunchi tools", async () => {
    const client = await createTestClient(await buildFixtureDocumentService());
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "compact_source_memory",
      "compare_search_explain",
      "delete_source",
      "export_source",
      "get_corpus_stats",
      "get_document",
      "get_llm_status",
      "get_source",
      "get_source_history",
      "get_source_status",
      "import_author_source",
      "list_sources",
      "refresh_source",
      "search_documents",
    ]);
  });

  it("searches fixture documents", async () => {
    const client = await createTestClient(await buildFixtureDocumentService());
    const result = await client.callTool({
      name: "search_documents",
      arguments: { query: "product", limit: 1, offset: 0 },
    });
    const text = textOf(result);
    expect(text).toContain("Search Results");
    expect(text).toContain("Showing 1");
  });

  it("imports an author source and exposes lifecycle tools", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-author-import-"));
    try {
      const client = await createTestClient(await buildService(dataDir, "test-corpus"));
      const imported = await client.callTool({
        name: "import_author_source",
        arguments: {
          fileContent: "# MCP Essay\n\nAgentic search notes.",
          fileName: "essay.md",
          authorId: "demo-author",
        },
      });
      expect(textOf(imported)).toContain("Imported Author");

      const status = await client.callTool({
        name: "get_source_status",
        arguments: { sourceId: "author:demo-author" },
      });
      expect(textOf(status)).toContain("Source Status");

      const exported = await client.callTool({
        name: "export_source",
        arguments: { sourceId: "author:demo-author", includeHistory: true },
      });
      expect(textOf(exported)).toContain("Exported Source");
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  it("returns structured error for missing document", async () => {
    const client = await createTestClient(await buildFixtureDocumentService());
    const result = await client.callTool({
      name: "get_document",
      arguments: { slug: "not-real-document", section: "metadata" },
    });
    expect(textOf(result)).toContain("not-real-document");
    expect(result.isError).toBe(true);
  });
});
