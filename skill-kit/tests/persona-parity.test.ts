import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCategory } from "../src/category-lenses.ts";
import { chatWithPersona } from "../src/chat.ts";
import { exportCloneMarkdown, importCloneMarkdown } from "../src/clone-markdown.ts";
import { addKnowledge } from "../src/knowledge.ts";
import { runPanelByCategory, runRoomAsk } from "../src/panel-debate.ts";
import { evaluatePersonaBenchmark } from "../src/persona-benchmark.ts";
import { providerStatus } from "../src/providers.ts";
import { redactSecrets, safeTopicSlug } from "../src/security.ts";
import { cloneStatus } from "../src/standalone.ts";
import type { Persona } from "../src/types.ts";

async function tempRoot(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix));
}

function demoPersona(authorId = "hayun"): Persona {
  return {
    personaId: `${authorId}-persona`,
    authorId,
    provider: "fake",
    not_real_person: true,
    claims: [
      {
        id: "claim-1",
        text: "고객 인터뷰를 우선한다.",
        confidence: "medium",
        evidence: [
          {
            quote: "고객 인터뷰를 우선한다.",
            chunkId: "chunk-1",
            elementId: "element-1",
            docId: "note",
            sourceFile: "note.md",
            lineStart: 1,
            lineEnd: 1,
          },
        ],
      },
    ],
    caveats: ["Simulated persona; not a real person."],
    displayName: "Hayun",
    tagline: "Grounded product thinker",
    primaryCategory: "founder",
    categories: ["founder", "tech"],
    voiceTraits: ["concise", "evidence-led"],
  };
}

test("supports provider parity and category parsing", () => {
  expect(parseCategory("vc")).toBe("vc");
  expect(() => parseCategory("unknown")).toThrow("Unknown category");
  expect(providerStatus({ provider: "openai", model: "gpt-5.5" }).provider).toBe(
    "openai-compatible"
  );
  expect(providerStatus({ provider: "ollama", model: "llama3.2" }).ready).toBe(true);
  const header = "Authorization" + ": " + "Bearer" + " sk-test";
  const token = "access_" + "token=abc";
  expect(redactSecrets(`${header} ${token}`)).toContain("<redacted>");
  expect(() => safeTopicSlug("../bad")).toThrow("Unsafe topic");
});

test("roundtrips clone markdown and stores chat history", async () => {
  const root = await tempRoot("persona-roundtrip-");
  try {
    const personaFile = join(root, "persona.json");
    const cloneDir = join(root, "clones", "hayun");
    const imported = join(root, "imported.json");
    const historyDir = join(root, "history");
    await writeFile(personaFile, `${JSON.stringify(demoPersona(), null, 2)}\n`);

    await exportCloneMarkdown(personaFile, cloneDir, { force: false });
    await importCloneMarkdown(cloneDir, imported);
    const importedPersona = JSON.parse(await readFile(imported, "utf8")) as Persona;
    expect(importedPersona.primaryCategory).toBe("founder");
    expect(importedPersona.voiceTraits).toContain("concise");
    expect(importedPersona.caveats.join(" ")).toContain("Simulated persona");

    const transcript = await chatWithPersona({
      personaFile: imported,
      prompt: "무엇을 우선해야 하나요?",
      provider: "fake",
      historyDir,
    });
    expect(transcript.markdown).toContain("Hayun");
    expect(transcript.sessionId.length).toBeGreaterThan(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports benchmark dimensions and persona workflow metadata", async () => {
  const root = await tempRoot("persona-benchmark-");
  try {
    const workspace = join(root, "workspace");
    const note = join(root, "note.md");
    const personaFile = join(root, "hayun.json");
    await writeFile(note, "고객 인터뷰를 우선한다.\n");
    await writeFile(personaFile, `${JSON.stringify(demoPersona(), null, 2)}\n`);
    await addKnowledge({
      workspace,
      source: note,
      sourceLabel: "note",
      topic: "투자철학",
      sourceType: "file",
      publishedAt: "2026-06-20",
    });

    const panel = await runPanelByCategory({
      personaDir: root,
      category: "founder",
      question: "무엇을 우선해야 하나요?",
      rounds: 1,
      out: join(root, "panel.md"),
      json: join(root, "panel.json"),
    });
    expect(panel.markdown).toContain("## Category Lens");

    const room = await runRoomAsk({
      personas: [personaFile],
      question: "무엇을 우선해야 하나요?",
      out: join(root, "room.md"),
      json: join(root, "room.json"),
    });
    expect(room.mode).toBe("stateless-room");
    expect(room.routing.selectedAuthorId).toBe("hayun");

    const report = await evaluatePersonaBenchmark("fixtures/persona-benchmark");
    expect(report.dimensions.providerParity.pass).toBe(true);
    expect(report.dimensions.personaChatReadiness.pass).toBe(true);
    expect(report.dimensions.migrationReadiness.pass).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects unsafe benchmark chat clone and status edges", async () => {
  const root = await tempRoot("persona-edges-");
  try {
    const personaFile = join(root, "persona.json");
    const cloneDir = join(root, "clones", "hayun");
    const imported = join(root, "imported.json");
    await writeFile(personaFile, `${JSON.stringify(demoPersona(), null, 2)}\n`);
    await exportCloneMarkdown(personaFile, cloneDir);
    await writeFile(imported, "{}\n");

    await expect(evaluatePersonaBenchmark(join(root, "missing"))).rejects.toThrow("fixture");
    const badFixture = join(root, "bad-fixture");
    await mkdir(join(badFixture, "clones", "douglas"), { recursive: true });
    await writeFile(join(badFixture, "expected.json"), "{}");
    await writeFile(join(badFixture, "clones", "douglas", "persona.md"), "bad");
    await expect(evaluatePersonaBenchmark(badFixture)).rejects.toThrow("denylisted");
    const badKnowledge = join(root, "bad-knowledge");
    await mkdir(join(badKnowledge, "clones", "hayun", "knowledge"), {
      recursive: true,
    });
    await writeFile(
      join(badKnowledge, "expected.json"),
      await readFile("fixtures/persona-benchmark/expected.json", "utf8")
    );
    await writeFile(
      join(badKnowledge, "clones", "hayun", "persona.md"),
      await readFile("fixtures/persona-benchmark/clones/hayun/persona.md", "utf8")
    );
    await writeFile(join(badKnowledge, "clones", "hayun", "knowledge", "not-dated.md"), "bad");
    const badKnowledgeReport = await evaluatePersonaBenchmark(badKnowledge);
    expect(badKnowledgeReport.dimensions.migrationReadiness.pass).toBe(false);
    expect(badKnowledgeReport.dimensions.overall.pass).toBe(false);
    const failedReport = join(root, "failed-report.json");
    const proc = Bun.spawnSync([
      "bun",
      "skill-kit/src/index.ts",
      "benchmark:persona",
      "--fixture",
      badKnowledge,
      "--out",
      failedReport,
    ]);
    expect(proc.exitCode).toBe(1);
    expect(await readFile(failedReport, "utf8")).toContain('"migrationReadiness"');
    const badCategory = join(root, "bad-category");
    await mkdir(join(badCategory, "clones", "hayun"), { recursive: true });
    await writeFile(
      join(badCategory, "expected.json"),
      await readFile("fixtures/persona-benchmark/expected.json", "utf8")
    );
    await writeFile(
      join(badCategory, "clones", "hayun", "persona.md"),
      (await readFile("fixtures/persona-benchmark/clones/hayun/persona.md", "utf8")).replace(
        "categories: founder,tech",
        "categories: not-a-category"
      )
    );
    const badCategoryReport = await evaluatePersonaBenchmark(badCategory);
    expect(badCategoryReport.dimensions.personaSchema.pass).toBe(false);
    expect(badCategoryReport.dimensions.categoryPanelReadiness.pass).toBe(false);
    await expect(
      chatWithPersona({
        personaFile,
        prompt: "x",
        provider: "fake",
        historyDir: join(root, "history"),
        resume: "../escape",
      })
    ).rejects.toThrow("Unsafe session");
    await expect(importCloneMarkdown(cloneDir, imported)).rejects.toThrow("already exists");
    expect(await pathExists(join(cloneDir, "knowledge"))).toBe(true);
    await expect(
      importCloneMarkdown(join(root, "bad-clone"), join(root, "bad.json"))
    ).rejects.toThrow("persona.md");
    expect((await cloneStatus(join(root, "clones"))).cloneCount).toBe(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function pathExists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  );
}
