import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addKnowledge } from "../src/knowledge.ts";
import { runPanelByCategory, runRoomAsk } from "../src/panel-debate.ts";
import { generatePersona, tagPersona } from "../src/persona.ts";

test("knowledge add ingests an absolute file into an existing workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "knowledge-add-"));
  try {
    const source = join(root, "note.md");
    const workspace = join(root, "workspace");
    await writeFile(source, "# Strategy\n\n한국어 지식 주입\n");

    const result = await addKnowledge({
      workspace,
      source,
      sourceLabel: "blog",
    });

    expect(result.docs).toHaveLength(1);
    expect(await readFile(join(workspace, "knowledge-sources.json"), "utf8")).toContain(
      '"sourceLabel": "blog"'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("persona tag persists unique categories", async () => {
  const root = await mkdtemp(join(tmpdir(), "persona-tag-"));
  try {
    const workspace = join(root, "workspace");
    await addKnowledge({
      workspace,
      source: "fixtures/ingestion/note.md",
      sourceLabel: "fixture",
    });
    const persona = join(root, "persona.json");
    await generatePersona({
      source: workspace,
      authorId: "demo",
      provider: "fake",
      out: persona,
    });

    const tagged = await tagPersona(persona, ["vc", "founder", "vc"]);

    expect(tagged.categories).toEqual(["vc", "founder"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("panel by category selects matching personas", async () => {
  const root = await mkdtemp(join(tmpdir(), "panel-category-"));
  try {
    const workspace = join(root, "workspace");
    await addKnowledge({
      workspace,
      source: "fixtures/ingestion/note.md",
      sourceLabel: "fixture",
    });
    const persona = join(root, "demo.json");
    await generatePersona({
      source: workspace,
      authorId: "demo",
      provider: "fake",
      out: persona,
    });
    await tagPersona(persona, ["vc"]);

    const result = await runPanelByCategory({
      personaDir: root,
      category: "vc",
      question: "What now?",
      rounds: 1,
      out: join(root, "panel.md"),
      json: join(root, "panel.json"),
    });

    expect(JSON.stringify(result)).toContain("demo");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("room ask writes a stateless transcript", async () => {
  const root = await mkdtemp(join(tmpdir(), "room-ask-"));
  try {
    const workspace = join(root, "workspace");
    await addKnowledge({
      workspace,
      source: "fixtures/ingestion/note.md",
      sourceLabel: "fixture",
    });
    const persona = join(root, "demo.json");
    await generatePersona({
      source: workspace,
      authorId: "demo",
      provider: "fake",
      out: persona,
    });

    await runRoomAsk({
      personas: [persona],
      question: "What now?",
      out: join(root, "room.md"),
      json: join(root, "room.json"),
    });

    expect(await readFile(join(root, "room.md"), "utf8")).toContain("Panel Debate");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
