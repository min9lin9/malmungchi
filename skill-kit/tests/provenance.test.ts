import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "../src/ingestion.ts";
import { generatePersona } from "../src/persona.ts";
import { loadElements, validatePersonaProvenance, writeChunks } from "../src/provenance.ts";

test("chunking emits complete stable provenance", async () => {
  const out = await mkdtemp(join(tmpdir(), "prov-"));
  await ingest("fixtures/ingestion", out);
  const chunks = await writeChunks(out, join(out, "chunks"));
  expect(chunks[0]?.chunkId).toContain(":c1");
});

test("persona provenance validates and preserves Korean quotes", async () => {
  const out = await mkdtemp(join(tmpdir(), "persona-prov-"));
  await ingest("fixtures/ingestion", out);
  const file = join(out, "persona.json");
  const persona = await generatePersona({
    source: out,
    authorId: "ko-author",
    provider: "fake",
    out: file,
  });
  expect(validatePersonaProvenance(persona)).toEqual([]);
  expect(JSON.stringify(persona)).toContain("한글");
});

test("missing quote is rejected", async () => {
  const failures = validatePersonaProvenance({
    personaId: "p",
    authorId: "a",
    provider: "fake",
    not_real_person: true,
    caveats: [],
    claims: [
      {
        id: "c",
        text: "x",
        confidence: "low",
        evidence: [
          {
            quote: "",
            chunkId: "c",
            elementId: "e",
            docId: "d",
            sourceFile: "f",
            lineStart: 1,
            lineEnd: 1,
          },
        ],
      },
    ],
  });
  expect(failures.join("\n")).toContain("missing quote");
});

test("loads elements from normalized workspace", async () => {
  const out = await mkdtemp(join(tmpdir(), "prov-load-"));
  await ingest("fixtures/ingestion", out);
  expect((await loadElements(out)).length).toBeGreaterThan(0);
});
