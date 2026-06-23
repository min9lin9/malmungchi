import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { CATEGORY_NAMES, type CategoryName } from "./category-lenses.ts";

const DENYLISTED_CLONE_SLUGS = new Set([
  "douglas",
  "chester",
  "brian",
  "sglee",
  "jojoldu",
  "chulwukim",
  "ethan",
  "gbjeong",
  "iid",
  "jayshin",
  "josh",
  "kyunghun",
  "levi",
  "johnkim",
]);

const REQUIRED_PROVIDERS = ["openai-compatible", "codex", "claude-code", "ollama", "fake"] as const;

const REQUIRED_COMMANDS = ["chat", "room", "panel", "list", "status", "history"] as const;

const REQUIRED_DIMENSIONS = [
  "personaSchema",
  "personaQuality",
  "personaChatReadiness",
  "categoryPanelReadiness",
  "groupRoomReadiness",
  "standaloneCliReadiness",
  "providerParity",
  "migrationReadiness",
  "securityReadiness",
  "overall",
] as const;

const CATEGORY_NAME_SET: ReadonlySet<string> = new Set(CATEGORY_NAMES);

export interface BenchmarkDimension {
  readonly pass: boolean;
  readonly score: number;
}

export interface PersonaBenchmarkReport {
  readonly dimensions: {
    readonly personaSchema: BenchmarkDimension;
    readonly personaQuality: BenchmarkDimension;
    readonly personaChatReadiness: BenchmarkDimension;
    readonly categoryPanelReadiness: BenchmarkDimension;
    readonly groupRoomReadiness: BenchmarkDimension;
    readonly standaloneCliReadiness: BenchmarkDimension;
    readonly providerParity: BenchmarkDimension;
    readonly migrationReadiness: BenchmarkDimension;
    readonly securityReadiness: BenchmarkDimension;
    readonly overall: BenchmarkDimension;
  };
}

export async function evaluatePersonaBenchmark(
  fixtureDir: string
): Promise<PersonaBenchmarkReport> {
  const expected = await readExpected(fixtureDir);
  const cloneEntries = await readdir(join(fixtureDir, "clones"), {
    withFileTypes: true,
  }).catch(() => {
    throw new Error(`Invalid persona fixture: ${fixtureDir}`);
  });
  const cloneNames = cloneEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  for (const name of cloneNames) {
    if (DENYLISTED_CLONE_SLUGS.has(name)) throw new Error(`denylisted persona clone slug: ${name}`);
  }
  const cloneReports = await Promise.all(
    cloneNames.map((name) => scoreClone(join(fixtureDir, "clones", name)))
  );
  const cloneCount = cloneReports.length;
  const categories = stringArray(expected.categories);
  const dimensions = stringArray(expected.dimensions);
  const providers = stringArray(expected.providers);
  const commands = stringArray(expected.commands);
  const pass = { pass: true, score: 1 };
  const categoryPass = CATEGORY_NAMES.every((name) => categories.includes(name));
  const dimensionPass = REQUIRED_DIMENSIONS.every((name) => dimensions.includes(name));
  const providerPass = REQUIRED_PROVIDERS.every((name) => providers.includes(name));
  const commandPass = REQUIRED_COMMANDS.every((name) => commands.includes(name));
  const schemaPass = cloneReports.every((report) => report.schema);
  const qualityPass = cloneReports.every((report) => report.quality);
  const knowledgePass = cloneReports.every((report) => report.knowledge);
  const fixturePass = cloneCount > 0 && dimensionPass && schemaPass && qualityPass && knowledgePass;
  const maybePass = (ok: boolean): BenchmarkDimension => (ok ? pass : { pass: false, score: 0 });
  const overallPass = categoryPass && fixturePass;
  return {
    dimensions: {
      personaSchema: maybePass(schemaPass),
      personaQuality: maybePass(qualityPass),
      personaChatReadiness: maybePass(commandPass && commands.includes("chat")),
      categoryPanelReadiness: maybePass(categoryPass && schemaPass),
      groupRoomReadiness: maybePass(commandPass && commands.includes("room")),
      standaloneCliReadiness: maybePass(commandPass),
      providerParity: maybePass(providerPass),
      migrationReadiness: maybePass(schemaPass && knowledgePass),
      securityReadiness: maybePass(fixturePass && providerPass),
      overall: maybePass(overallPass && providerPass && commandPass),
    },
  };
}

async function scoreClone(cloneDir: string): Promise<{
  readonly schema: boolean;
  readonly quality: boolean;
  readonly knowledge: boolean;
}> {
  const persona = await readFile(join(cloneDir, "persona.md"), "utf8").catch(() => "");
  if (!persona) return { schema: false, quality: false, knowledge: false };
  const requiredSections = [
    "## Persona Narrative",
    "## Speaking style",
    "## Guidelines",
    "## Background",
  ];
  const categories = cloneCategories(persona);
  const primaryCategory = frontmatterValue(persona, "primary_category");
  const schema =
    persona.includes("not_real_person: true") &&
    categories.length > 0 &&
    categories.some((name) => name === primaryCategory) &&
    frontmatterValue(persona, "voice_traits").length > 0 &&
    requiredSections.every((section) => persona.includes(section));
  const quality = /[가-힣]/u.test(persona) && /simulated|not a real person/i.test(persona);
  const knowledgeEntries = await readdir(join(cloneDir, "knowledge")).catch(() => []);
  const knowledge = await knowledgeEntriesPass(cloneDir, knowledgeEntries);
  return { schema, quality, knowledge };
}

async function knowledgeEntriesPass(
  cloneDir: string,
  entries: readonly string[]
): Promise<boolean> {
  for (const entry of entries) {
    if (!/^\d{4}-\d{2}-\d{2}-[-\w]+\.md$/u.test(entry)) return false;
    if (!(await lstat(join(cloneDir, "knowledge", entry))).isFile()) return false;
  }
  return true;
}

function cloneCategories(persona: string): readonly CategoryName[] {
  const names = frontmatterValue(persona, "categories")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (!names.every((item): item is CategoryName => CATEGORY_NAME_SET.has(item))) return [];
  return names;
}

function frontmatterValue(persona: string, key: string): string {
  const prefix = `${key}:`;
  return (
    persona
      .split(/\r?\n/)
      .find((line) => line.startsWith(prefix))
      ?.slice(prefix.length)
      .trim() ?? ""
  );
}

async function readExpected(fixtureDir: string): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(fixtureDir, "expected.json"), "utf8"));
    if (isRecord(parsed)) return parsed;
  } catch (error) {
    if (error instanceof Error) throw new Error(`Invalid persona fixture: ${fixtureDir}`);
    throw error;
  }
  throw new Error(`Invalid persona fixture: ${fixtureDir}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
