import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateAuthorJsonl } from "../author-source.ts";
import { chatWithPersona } from "../chat.ts";
import { exportCloneMarkdown, importCloneMarkdown } from "../clone-markdown.ts";
import { evalFixture } from "../eval4sim.ts";
import { ingest } from "../ingestion.ts";
import { runDebate } from "../panel-debate.ts";
import { generatePersona, tagPersona } from "../persona.ts";
import { evaluatePersonaBenchmark } from "../persona-benchmark.ts";
import { judgePps } from "../pps.ts";
import { writeChunks } from "../provenance.ts";
import { providerStatus } from "../providers.ts";
import { cloneStatus, readHistorySummary } from "../standalone.ts";

async function ensureFixture(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "note.md"),
    "# 제품 전략\n\nEvidence-backed product strategy note.\n\n- 한국어 보존\n"
  );
  await writeFile(
    join(dir, "data.json"),
    JSON.stringify({ category: "growth", nested: { ko: "안녕하세요" } }, null, 2)
  );
}

export async function qaE2e(): Promise<void> {
  const temp = await mkdtemp(join(tmpdir(), "malmungchi-"));
  const evidence = join(temp, "evidence");
  await mkdir(evidence, { recursive: true });
  try {
    const input = join(temp, "input");
    const normalized = join(temp, "normalized");
    await ensureFixture(input);
    await ingest(input, normalized);
    await writeChunks(normalized, join(normalized, "chunks"));
    const sourceFile = join(temp, "author.jsonl");
    await generateAuthorJsonl(normalized, "skill-kit-demo", sourceFile);
    const personaFile = join(temp, "persona.json");
    const personaMd = join(temp, "persona.md");
    await generatePersona({
      source: normalized,
      authorId: "skill-kit-demo",
      provider: "fake",
      out: personaFile,
      markdown: personaMd,
    });
    await tagPersona(personaFile, ["founder"], "founder");
    const cloneDir = join(temp, "clones", "skill-kit-demo");
    const importedPersona = join(temp, "persona-imported.json");
    await exportCloneMarkdown(personaFile, cloneDir, { force: true });
    await importCloneMarkdown(cloneDir, importedPersona);
    providerStatus({ provider: "fake" });
    await chatWithPersona({
      personaFile: importedPersona,
      prompt: "What next?",
      provider: "fake",
      historyDir: join(temp, "history"),
    });
    await readHistorySummary(join(temp, "history"));
    await cloneStatus(join(temp, "clones"));
    await evaluatePersonaBenchmark("fixtures/persona-benchmark");
    await evalFixture("fixtures/eval4sim/pass", join(evidence, "task-13-eval4sim.json"));
    await judgePps(personaFile, "fake", join(evidence, "task-13-pps.json"));
    await runDebate({
      personas: [personaFile],
      question: "What should the team prioritize?",
      rounds: 1,
      out: join(evidence, "task-13-debate.md"),
      json: join(evidence, "task-13-debate.json"),
    });
    await writeFile(
      join(evidence, "task-13-cleanup.json"),
      JSON.stringify({ temp, cleaned: true }, null, 2)
    );
    console.log("malmungchi e2e ok");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
