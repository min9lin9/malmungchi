import { createHash } from "node:crypto";
import { cp, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { writeJsonl } from "./fs-jsonl.ts";
import type { NormalizedElement } from "./types.ts";

function stableId(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 12);
}

async function listInputs(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && [".md", ".json"].includes(extname(entry.name)))
    .map((entry) => join(root, entry.name))
    .sort();
}

function markdownElements(docId: string, sourceFile: string, text: string): NormalizedElement[] {
  const rows: NormalizedElement[] = [];
  let code = false;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const lineNo = index + 1;
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith("```")) code = !code;
    const kind =
      code || trimmed.startsWith("```")
        ? "code"
        : trimmed.startsWith("#")
          ? "heading"
          : /^[-*]\s+/.test(trimmed)
            ? "list"
            : trimmed.includes("|")
              ? "table"
              : "paragraph";
    rows.push({
      docId,
      elementId: `${docId}:e${rows.length + 1}`,
      kind,
      text: line,
      sourceFile,
      lineStart: lineNo,
      lineEnd: lineNo,
    });
  }
  return rows;
}

function flattenJson(value: unknown, path = "$"): Array<{ path: string; text: string }> {
  if (value === null || typeof value !== "object") {
    return [{ path, text: JSON.stringify(value) }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenJson(item, `${path}[${index}]`));
  }
  return Object.entries(value).flatMap(([key, child]) => flattenJson(child, `${path}.${key}`));
}

export async function ingest(inputDir: string, outDir: string): Promise<{ docs: string[] }> {
  const root = await realpath(resolve(inputDir));
  await mkdir(join(outDir, "raw"), { recursive: true });
  await mkdir(join(outDir, "normalized"), { recursive: true });
  const docs: string[] = [];
  for (const file of await listInputs(root)) {
    const sourceFile = basename(file);
    const rawTarget = join(outDir, "raw", sourceFile);
    await cp(file, rawTarget);
    const text = await readFile(file, "utf8");
    const docId = `${basename(sourceFile, extname(sourceFile)).replace(/[^a-zA-Z0-9가-힣_-]+/g, "-")}-${stableId(`${relative(root, file)}\n${text}`)}`;
    const docDir = join(outDir, "normalized", docId);
    await mkdir(docDir, { recursive: true });
    let elements: NormalizedElement[];
    let document = text;
    if (extname(file) === ".json") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (error) {
        throw new Error(`Invalid JSON in ${sourceFile}: ${String(error)}`);
      }
      document = `# ${sourceFile}\n\n\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n`;
      elements = flattenJson(parsed).map((row, index) => ({
        docId,
        elementId: `${docId}:e${index + 1}`,
        kind: "json",
        text: row.text,
        sourceFile,
        lineStart: 1,
        lineEnd: text.split(/\r?\n/).length,
        path: row.path,
      }));
    } else {
      elements = markdownElements(docId, sourceFile, text);
    }
    await writeFile(join(docDir, "document.md"), document);
    await writeJsonl(join(docDir, "elements.jsonl"), elements);
    docs.push(docId);
  }
  return { docs };
}
