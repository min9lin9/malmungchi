import { cp, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { ingest } from "./ingestion.ts";
import { safeCategorySlug } from "./security.ts";

export interface KnowledgeAddResult {
  readonly docs: readonly string[];
  readonly sourceLabel: string;
  readonly source: string;
  readonly category?: string;
  readonly sourceType?: KnowledgeSourceType;
  readonly publishedAt?: string;
}

export type KnowledgeSourceType = "file" | "text" | "url" | "youtube" | "interview" | "social";

export function parseKnowledgeSourceType(
  value: string | undefined
): KnowledgeSourceType | undefined {
  if (!value) return undefined;
  if (
    value === "file" ||
    value === "text" ||
    value === "url" ||
    value === "youtube" ||
    value === "interview" ||
    value === "social"
  )
    return value;
  throw new Error(`Unknown source type: ${value}`);
}

async function readExistingSources(file: string): Promise<readonly unknown[]> {
  const text = await readFile(file, "utf8").catch(() => "[]");
  const parsed: unknown = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [];
}

export async function addKnowledge(options: {
  readonly workspace: string;
  readonly source: string;
  readonly sourceLabel: string;
  readonly category?: string;
  readonly sourceType?: KnowledgeSourceType;
  readonly publishedAt?: string;
}): Promise<KnowledgeAddResult> {
  if (options.publishedAt && !/^\d{4}-\d{2}-\d{2}$/u.test(options.publishedAt))
    throw new Error(`Invalid published-at date: ${options.publishedAt}`);
  const source = await realpath(resolve(options.source));
  const sourceStat = await stat(source);
  await mkdir(options.workspace, { recursive: true });
  const temp = sourceStat.isDirectory()
    ? undefined
    : await mkdtemp(join(options.workspace, ".knowledge-add-"));
  try {
    const input = temp ?? source;
    if (temp) await cp(source, join(temp, basename(source)));
    const result = await ingest(input, options.workspace);
    const record: KnowledgeAddResult = {
      docs: result.docs,
      source,
      sourceLabel: options.sourceLabel,
      category: options.category,
      sourceType: options.sourceType,
      publishedAt: options.publishedAt,
    };
    const manifest = join(options.workspace, "knowledge-sources.json");
    const existing = await readExistingSources(manifest);
    await writeFile(manifest, `${JSON.stringify([...existing, record], null, 2)}\n`);
    if (options.category && options.publishedAt) {
      await mkdir(join(options.workspace, "knowledge"), { recursive: true });
      await writeFile(
        join(
          options.workspace,
          "knowledge",
          `${options.publishedAt}-${safeCategorySlug(options.category)}.md`
        ),
        [
          "---",
          `category: ${options.category}`,
          `source_type: ${options.sourceType ?? "file"}`,
          `source_path: ${source}`,
          `published_at: ${options.publishedAt}`,
          "fetched: false",
          "---",
          "",
        ].join("\n")
      );
    }
    return record;
  } finally {
    if (temp) await rm(temp, { recursive: true, force: true });
  }
}
