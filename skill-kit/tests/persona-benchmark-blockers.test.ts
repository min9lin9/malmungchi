import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportCloneMarkdown, importCloneMarkdown } from "../src/clone-markdown.ts";
import { evaluatePersonaBenchmark } from "../src/persona-benchmark.ts";
import { evaluateCorpusPersonaQuality } from "../src/persona-quality-benchmark.ts";

async function tempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "persona-blockers-"));
}

async function writeFixture(
  root: string,
  personaText: string,
  expectedPatch: Record<string, unknown> = {}
): Promise<string> {
  const fixture = join(root, "fixture");
  await mkdir(join(fixture, "clones", "hayun", "knowledge"), {
    recursive: true,
  });
  const expected = JSON.parse(
    await readFile("fixtures/persona-benchmark/expected.json", "utf8")
  ) as Record<string, unknown>;
  await writeFile(
    join(fixture, "expected.json"),
    `${JSON.stringify({ ...expected, ...expectedPatch }, null, 2)}\n`
  );
  await writeFile(join(fixture, "clones", "hayun", "persona.md"), personaText);
  return fixture;
}

test("benchmark rejects mixed invalid category frontmatter", async () => {
  const root = await tempRoot();
  try {
    const persona = (
      await readFile("fixtures/persona-benchmark/clones/hayun/persona.md", "utf8")
    ).replace("categories: founder,tech", "categories: founder,not-a-category");
    const report = await evaluatePersonaBenchmark(await writeFixture(root, persona));
    expect(report.dimensions.personaSchema.pass).toBe(false);
    expect(report.dimensions.categoryPanelReadiness.pass).toBe(false);
    expect(report.dimensions.overall.pass).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("benchmark validates expected dimension names", async () => {
  const root = await tempRoot();
  try {
    const persona = await readFile("fixtures/persona-benchmark/clones/hayun/persona.md", "utf8");
    const report = await evaluatePersonaBenchmark(
      await writeFixture(root, persona, {
        dimensions: ["x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8", "x9"],
      })
    );
    expect(report.dimensions.overall.pass).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("clone import rejects symlinked knowledge entries", async () => {
  const root = await tempRoot();
  try {
    const cloneDir = join(root, "hayun");
    await mkdir(join(cloneDir, "knowledge"), { recursive: true });
    await writeFile(
      join(cloneDir, "persona.md"),
      await readFile("fixtures/persona-benchmark/clones/hayun/persona.md", "utf8")
    );
    await symlink("/etc/passwd", join(cloneDir, "knowledge", "2026-06-20-test.md"));
    await expect(importCloneMarkdown(cloneDir, join(root, "imported.json"))).rejects.toThrow(
      "regular file"
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("benchmark rejects symlinked knowledge entries", async () => {
  const root = await tempRoot();
  try {
    const fixture = await writeFixture(
      root,
      await readFile("fixtures/persona-benchmark/clones/hayun/persona.md", "utf8")
    );
    await symlink(
      "/etc/passwd",
      join(fixture, "clones", "hayun", "knowledge", "2026-06-20-test.md")
    );
    const report = await evaluatePersonaBenchmark(fixture);
    expect(report.dimensions.migrationReadiness.pass).toBe(false);
    expect(report.dimensions.securityReadiness.pass).toBe(false);
    expect(report.dimensions.overall.pass).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("clone export preserves importable simulated disclaimer", async () => {
  const root = await tempRoot();
  try {
    const personaFile = join(root, "persona.json");
    const cloneDir = join(root, "hayun");
    await writeFile(
      personaFile,
      `${JSON.stringify({
        personaId: "hayun-persona",
        authorId: "hayun",
        provider: "fake",
        not_real_person: true,
        claims: [],
        caveats: ["No source evidence was available; no claims were fabricated."],
        categories: ["founder"],
        primaryCategory: "founder",
      })}\n`
    );
    await exportCloneMarkdown(personaFile, cloneDir);
    await importCloneMarkdown(cloneDir, join(root, "imported.json"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("corpus quality benchmark requires corpus-backed citations", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(
    async () =>
      new Response(
        JSON.stringify({
          documents: [
            {
              content: "고객 인터뷰를 우선한다. 근거 기반으로 판단한다.",
              sourceId: "author:demo",
              provenance: { sourceId: "author:other" },
            },
          ],
        })
      ),
    { preconnect: originalFetch.preconnect }
  );
  try {
    const report = await evaluateCorpusPersonaQuality({
      corpusUrl: "http://127.0.0.1:3000",
      authorId: "demo",
      allowRemote: false,
    });
    expect(report.dimensions.retrievalGrounding.pass).toBe(true);
    expect(report.dimensions.citationCoverage.pass).toBe(false);
    expect(report.dimensions.overall.pass).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("corpus quality benchmark rejects missing provenance source id", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(
    async () =>
      new Response(
        JSON.stringify({
          documents: [
            {
              content: "고객 인터뷰를 우선한다. 근거 기반으로 판단한다.",
              sourceId: "author:demo",
              provenance: {},
            },
          ],
        })
      ),
    { preconnect: originalFetch.preconnect }
  );
  try {
    const report = await evaluateCorpusPersonaQuality({
      corpusUrl: "http://127.0.0.1:3000",
      authorId: "demo",
      allowRemote: false,
    });
    expect(report.dimensions.retrievalGrounding.pass).toBe(true);
    expect(report.dimensions.citationCoverage.pass).toBe(false);
    expect(report.dimensions.overall.pass).toBe(false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
