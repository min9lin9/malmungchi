import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingest } from "../src/ingestion.ts";
import { loadElements } from "../src/provenance.ts";

test("normalizes markdown and json while preserving Korean text", async () => {
  const out = await mkdtemp(join(tmpdir(), "ingest-"));
  try {
    const result = await ingest("fixtures/ingestion", out);
    expect(result.docs).toHaveLength(2);
    const elements = await loadElements(out);
    expect(
      elements.some(
        (element) => element.text.includes("안녕하세요") || element.text.includes("한글")
      )
    ).toBe(true);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("malformed json fails clearly", async () => {
  const out = await mkdtemp(join(tmpdir(), "ingest-bad-"));
  try {
    await expect(ingest("fixtures/malformed-json", out)).rejects.toThrow("Invalid JSON");
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("duplicate basenames get stable distinct ids", async () => {
  await mkdir("tmp", { recursive: true });
  const root = await mkdtemp(join(process.cwd(), "tmp", "ingest-dupes-"));
  const out = await mkdtemp(join(tmpdir(), "ingest-dupes-out-"));
  try {
    await writeFile(join(root, "same.md"), "# A\n");
    await writeFile(join(root, "same.json"), '{"a":1}');
    const result = await ingest(root, out);
    expect(new Set(result.docs).size).toBe(2);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(out, { recursive: true, force: true });
  }
});

test("writes normalized document markdown", async () => {
  const out = await mkdtemp(join(tmpdir(), "ingest-doc-"));
  try {
    const result = await ingest("fixtures/ingestion", out);
    const jsonDoc = result.docs.find((doc) => doc.startsWith("data-"));
    expect(typeof jsonDoc).toBe("string");
    expect(await readFile(join(out, "normalized", jsonDoc ?? "", "document.md"), "utf8")).toContain(
      "```json"
    );
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test("accepts absolute input folders for Codex workspace paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "ingest-absolute-"));
  const out = await mkdtemp(join(tmpdir(), "ingest-absolute-out-"));
  try {
    await writeFile(join(root, "note.md"), "# Absolute\n\n한국어 절대경로\n");
    const result = await ingest(root, out);
    expect(result.docs).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(out, { recursive: true, force: true });
  }
});
