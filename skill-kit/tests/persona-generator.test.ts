import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "../src/ingestion.ts";
import { generatePersona } from "../src/persona.ts";

test("generates json and markdown with disclaimer", async () => {
  const out = await mkdtemp(join(tmpdir(), "persona-"));
  await ingest("fixtures/ingestion", out);
  const json = join(out, "persona.json");
  const md = join(out, "persona.md");
  const persona = await generatePersona({
    source: out,
    authorId: "demo",
    provider: "fake",
    out: json,
    markdown: md,
  });
  expect(persona.not_real_person).toBe(true);
  expect(await readFile(md, "utf8")).toContain("not the real person");
});

test("empty source produces bounded persona without fabricated claims", async () => {
  const out = await mkdtemp(join(tmpdir(), "persona-empty-"));
  const persona = await generatePersona({
    source: join(out, "missing"),
    authorId: "empty",
    provider: "fake",
    out: join(out, "p.json"),
  });
  expect(persona.claims).toHaveLength(0);
  expect(persona.caveats[0]).toContain("No source evidence");
});

test("corpus backed persona uses exported author evidence", async () => {
  const out = await mkdtemp(join(tmpdir(), "persona-corpus-"));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(
    async (input: string | URL | Request) => {
      expect(String(input)).toContain("/corpus/sources/author%3Ademo/export");
      return new Response(
        JSON.stringify({
          documents: [
            {
              slug: "author:demo:essay",
              sourceId: "author:demo",
              content: "고객 인터뷰를 우선한다.",
            },
          ],
        }),
        { status: 200 }
      );
    },
    { preconnect: originalFetch.preconnect }
  );
  try {
    const persona = await generatePersona({
      corpusUrl: "http://127.0.0.1:3000",
      authorId: "demo",
      provider: "fake",
      out: join(out, "p.json"),
    });
    expect(persona.claims[0]?.evidence[0]?.sourceFile).toBe("author:demo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
