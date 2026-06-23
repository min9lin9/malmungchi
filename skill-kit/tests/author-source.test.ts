import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateAuthorJsonl, importAuthorHttp } from "../src/author-source.ts";
import { ingest } from "../src/ingestion.ts";

test("generates malmungchi-friendly jsonl", async () => {
  const out = await mkdtemp(join(tmpdir(), "author-"));
  await ingest("fixtures/ingestion", out);
  const content = await generateAuthorJsonl(out, "skill-kit-demo", join(out, "author.jsonl"));
  expect(content).toContain('"tocKey"');
  expect(content).toContain("skill-kit-demo");
});

test("invalid normalized folder fails before http", async () => {
  await expect(
    generateAuthorJsonl("/tmp/missing-normalized", "bad", "/tmp/bad.jsonl")
  ).rejects.toThrow();
});

test("author http import sends tocKey for jsonl content", async () => {
  const originalFetch = globalThis.fetch;
  let body = "";
  globalThis.fetch = Object.assign(
    async (_url: string | URL | Request, init?: RequestInit) => {
      body = String(init?.body ?? "");
      return new Response(JSON.stringify({ sourceId: "author:demo" }), {
        status: 200,
      });
    },
    { preconnect: originalFetch.preconnect }
  );
  try {
    await importAuthorHttp({
      authorId: "demo",
      fileContent: '{"tocKey":"intro","content":"Body"}\n',
      malmungchiUrl: "http://127.0.0.1:3000",
      allowRemote: false,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(JSON.parse(body)).toEqual(
    expect.objectContaining({
      tocKey: "tocKey",
    })
  );
});
