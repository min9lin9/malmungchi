import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "../src/ingestion.ts";
import { generatePersona } from "../src/persona.ts";
import { judgePps } from "../src/pps.ts";

test("pps passes for evidenced persona", async () => {
  const out = await mkdtemp(join(tmpdir(), "pps-"));
  await ingest("fixtures/ingestion", out);
  const file = join(out, "p.json");
  await generatePersona({
    source: out,
    authorId: "demo",
    provider: "fake",
    out: file,
  });
  expect((await judgePps(file, "fake")).pass).toBe(true);
});

test("pps fails for empty persona minimum factor", async () => {
  const out = await mkdtemp(join(tmpdir(), "pps-empty-"));
  const file = join(out, "p.json");
  await generatePersona({
    source: join(out, "missing"),
    authorId: "empty",
    provider: "fake",
    out: file,
  });
  await expect(judgePps(file, "fake")).rejects.toThrow("completeness");
});
