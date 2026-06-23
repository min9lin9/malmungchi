import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "../src/ingestion.ts";
import { runDebate } from "../src/panel-debate.ts";
import { generatePersona } from "../src/persona.ts";

test("runs markdown and json debate", async () => {
  const out = await mkdtemp(join(tmpdir(), "debate-"));
  await ingest("fixtures/ingestion", out);
  const persona = join(out, "p.json");
  await generatePersona({
    source: out,
    authorId: "demo",
    provider: "fake",
    out: persona,
  });
  const result = await runDebate({
    personas: [persona],
    question: "What now?",
    rounds: 2,
    out: join(out, "d.md"),
    json: join(out, "d.json"),
  });
  expect(JSON.stringify(result)).toContain("moderatorSummary");
});

test("rejects six personas and too many rounds", async () => {
  await expect(
    runDebate({
      personas: ["a", "b", "c", "d", "e", "f"],
      question: "x",
      rounds: 1,
      out: "/tmp/x.md",
    })
  ).rejects.toThrow("maximum 5 personas");
  await expect(
    runDebate({ personas: ["a"], question: "x", rounds: 6, out: "/tmp/x.md" })
  ).rejects.toThrow("maximum 5 rounds");
});
