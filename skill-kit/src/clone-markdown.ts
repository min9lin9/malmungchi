import { lstat, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { getCategoryLens, parseCategory } from "./category-lenses.ts";
import { readPersona } from "./persona.ts";
import type { Persona } from "./types.ts";

export async function exportCloneMarkdown(
  personaFile: string,
  outDir: string,
  options: { readonly force?: boolean } = {}
): Promise<string> {
  const persona = await readPersona(personaFile);
  const exists = await stat(join(outDir, "persona.md")).then(
    () => true,
    () => false
  );
  if (exists && !options.force) throw new Error(`clone already exists: ${outDir}`);
  await mkdir(outDir, { recursive: true });
  const categories = persona.categories ?? [];
  const body = [
    "---",
    `name: ${persona.authorId}`,
    `display_name: ${persona.displayName ?? persona.authorId}`,
    `tagline: ${persona.tagline ?? ""}`,
    `categories: ${categories.join(",")}`,
    `primary_category: ${persona.primaryCategory ?? categories[0] ?? ""}`,
    `voice_traits: ${(persona.voiceTraits ?? []).join(",")}`,
    "not_real_person: true",
    "---",
    "",
    "## Persona Narrative",
    persona.claims[0]?.text ?? "No grounded claim available.",
    "",
    "## Speaking style",
    (persona.voiceTraits ?? ["grounded"]).join(", "),
    "",
    "## Guidelines",
    disclaimerText(persona.caveats),
    "",
    "## Background",
    persona.claims
      .flatMap((claim) => claim.evidence)
      .map((item) => `- ${item.quote} (${item.sourceFile}:${item.lineStart})`)
      .join("\n"),
  ].join("\n");
  await writeFile(join(outDir, "persona.md"), `${body}\n`);
  await mkdir(join(outDir, "knowledge"), { recursive: true });
  return outDir;
}

export async function importCloneMarkdown(
  cloneDir: string,
  outFile: string,
  options: { readonly force?: boolean } = {}
): Promise<Persona> {
  const exists = await stat(outFile).then(
    () => true,
    () => false
  );
  if (exists && !options.force) throw new Error(`output already exists: ${outFile}`);
  const text = await readFile(join(cloneDir, "persona.md"), "utf8");
  const { frontmatter, sections } = parseCloneMarkdown(text);
  if (frontmatter.name && frontmatter.name !== basename(cloneDir))
    throw new Error("clone slug does not match persona name");
  if (frontmatter.not_real_person !== "true")
    throw new Error("clone must declare not_real_person: true");
  const categories = parseList(frontmatter.categories).map(parseCategory);
  if (categories.length === 0) throw new Error("clone requires categories");
  const firstCategory = categories[0];
  if (!firstCategory) throw new Error("clone requires categories");
  const primaryCategory = parseCategory(frontmatter.primary_category ?? firstCategory);
  getCategoryLens(primaryCategory);
  assertSectionOrder(sections);
  const narrative = requiredSection(sections, "Persona Narrative");
  const guidelines = requiredSection(sections, "Guidelines");
  if (!/simulated|not a real person/i.test(guidelines))
    throw new Error("clone must preserve simulated-person disclaimer");
  const persona: Persona = {
    personaId: `${frontmatter.name ?? basename(cloneDir)}-persona`,
    authorId: frontmatter.name ?? basename(cloneDir),
    provider: "fake",
    not_real_person: true,
    categories,
    primaryCategory,
    displayName: frontmatter.display_name,
    tagline: frontmatter.tagline,
    voiceTraits: parseList(frontmatter.voice_traits),
    caveats: [guidelines],
    claims: [
      {
        id: "claim-1",
        text: narrative,
        confidence: "medium",
        evidence: [
          {
            quote: narrative,
            chunkId: "clone-md",
            elementId: "persona-narrative",
            docId: "persona",
            sourceFile: join(cloneDir, "persona.md"),
            lineStart: 1,
            lineEnd: 1,
          },
        ],
      },
    ],
  };
  await copyKnowledge(cloneDir, outFile);
  await writeFile(outFile, `${JSON.stringify(persona, null, 2)}\n`);
  return persona;
}

function parseCloneMarkdown(text: string): {
  readonly frontmatter: Record<string, string>;
  readonly sections: ReadonlyMap<string, string>;
} {
  const lines = text.split(/\r?\n/);
  if (lines[0] !== "---") throw new Error("persona.md requires frontmatter");
  const end = lines.indexOf("---", 1);
  if (end < 0) throw new Error("persona.md frontmatter is not closed");
  const frontmatter: Record<string, string> = {};
  for (const line of lines.slice(1, end)) {
    const [key, ...rest] = line.split(":");
    if (key) frontmatter[key.trim()] = rest.join(":").trim();
  }
  const sections = new Map<string, string>();
  let current = "";
  let body: string[] = [];
  for (const line of lines.slice(end + 1)) {
    if (line.startsWith("## ")) {
      if (current) sections.set(current, body.join("\n").trim());
      current = line.slice(3).trim();
      body = [];
      continue;
    }
    body.push(line);
  }
  if (current) sections.set(current, body.join("\n").trim());
  return { frontmatter, sections };
}

function disclaimerText(caveats: readonly string[]): string {
  const fallback = "Simulated persona; not a real person.";
  if (caveats.length === 0) return fallback;
  const text = caveats.join(" ");
  return /simulated|not a real person/i.test(text) ? text : `${text} ${fallback}`;
}

function parseList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function requiredSection(sections: ReadonlyMap<string, string>, name: string): string {
  const section = sections.get(name);
  if (!section) throw new Error(`persona.md missing section: ${name}`);
  return section;
}

function assertSectionOrder(sections: ReadonlyMap<string, string>): void {
  const required = ["Persona Narrative", "Speaking style", "Guidelines", "Background"];
  const names = [...sections.keys()];
  let last = -1;
  for (const name of required) {
    const index = names.indexOf(name);
    if (index <= last) throw new Error(`persona.md section order invalid: ${name}`);
    last = index;
  }
}

async function copyKnowledge(cloneDir: string, outFile: string): Promise<void> {
  const knowledgeDir = join(cloneDir, "knowledge");
  const entries = await readdir(knowledgeDir).catch(() => []);
  if (entries.length === 0) return;
  const outKnowledge = join(outFile, "..", "knowledge");
  await mkdir(outKnowledge, { recursive: true });
  for (const entry of entries) {
    if (!/^\d{4}-\d{2}-\d{2}-[-\w]+\.md$/u.test(entry))
      throw new Error(`Invalid knowledge filename: ${entry}`);
    const source = join(knowledgeDir, entry);
    if (!(await lstat(source)).isFile())
      throw new Error(`Knowledge entry must be a regular file: ${entry}`);
    await writeFile(join(outKnowledge, entry), await readFile(source));
  }
}
