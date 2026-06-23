import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCategory } from "./category-lenses.ts";
import { createProvider, type ProviderName } from "./llm.ts";
import {
  chunkElements,
  evidenceFromChunk,
  loadElements,
  validatePersonaProvenance,
} from "./provenance.ts";
import { assertLocalMalmunchiUrl, redactSecrets } from "./security.ts";
import type { Persona } from "./types.ts";

export async function generatePersona(options: {
  source?: string;
  authorId: string;
  provider: ProviderName;
  out: string;
  markdown?: string;
  malmunchiUrl?: string;
  allowRemoteMalmunchi?: boolean;
}): Promise<Persona> {
  const provider = createProvider(options.provider);
  const chunks = options.malmunchiUrl
    ? await loadDocumentsChunks({
        malmunchiUrl: options.malmunchiUrl,
        authorId: options.authorId,
        allowRemote: options.allowRemoteMalmunchi ?? false,
      })
    : chunkElements(options.source ? await loadElements(options.source).catch(() => []) : []).slice(
        0,
        5
      );
  await provider.complete(
    `persona:${options.authorId}:${chunks.map((chunk) => chunk.text).join("\n")}`
  );
  const claims = chunks.map((chunk, index) => ({
    id: `claim-${index + 1}`,
    text: `This simulated persona is grounded in: ${chunk.text.slice(0, 120)}`,
    confidence: "medium" as const,
    evidence: [evidenceFromChunk(chunk)],
  }));
  const persona: Persona = {
    personaId: `${options.authorId}-persona`,
    authorId: options.authorId,
    provider: provider.name,
    not_real_person: true,
    claims,
    caveats:
      claims.length === 0 ? ["No source evidence was available; no claims were fabricated."] : [],
  };
  const failures = validatePersonaProvenance(persona);
  if (failures.length > 0) throw new Error(`Invalid persona provenance: ${failures.join(", ")}`);
  await writeFile(options.out, `${JSON.stringify(persona, null, 2)}\n`);
  if (options.markdown) {
    await writeFile(
      options.markdown,
      [
        `# ${persona.authorId}`,
        "",
        "This is a bounded simulation, not the real person.",
        ...persona.claims.map(
          (claim) =>
            `- ${claim.text} [${claim.evidence[0]?.sourceFile}:${claim.evidence[0]?.lineStart}]`
        ),
      ].join("\n")
    );
  }
  return persona;
}

async function loadDocumentsChunks(options: {
  malmunchiUrl: string;
  authorId: string;
  allowRemote: boolean;
}) {
  const url = assertLocalMalmunchiUrl(options.malmunchiUrl, options.allowRemote);
  const sourceId = `author:${options.authorId}`;
  const exportUrl = new URL(`/malmunchi/sources/${encodeURIComponent(sourceId)}/export`, url);
  exportUrl.searchParams.set("format", "json");
  exportUrl.searchParams.set("includeHistory", "true");
  const response = await fetch(exportUrl);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Malmunchi source export failed ${response.status}: ${redactSecrets(text)}`);
  }
  return malmunchiDocuments(JSON.parse(text), sourceId)
    .slice(0, 5)
    .map((document, index) => ({
      docId: document.slug,
      elementId: `malmunchi-export-${index + 1}`,
      chunkId: `${document.slug}#${index + 1}`,
      text: document.content,
      sourceFile: document.sourceId,
      lineStart: 1,
      lineEnd: Math.max(1, document.content.split(/\r?\n/).length),
    }));
}

function malmunchiDocuments(
  value: unknown,
  sourceId: string
): Array<{ slug: string; content: string; sourceId: string }> {
  if (!isRecord(value) || !Array.isArray(value.documents)) return [];
  return value.documents
    .filter(isRecord)
    .map((document) => ({
      slug: stringField(document.slug) ?? "malmunchi-document",
      content: stringField(document.content) ?? "",
      sourceId: stringField(document.sourceId) ?? sourceId,
    }))
    .filter((document) => document.content.length > 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

export async function readPersona(file: string): Promise<Persona> {
  return JSON.parse(await readFile(file, "utf8")) as Persona;
}

export async function tagPersona(
  file: string,
  categories: readonly string[],
  primaryCategory?: string
): Promise<Persona> {
  const persona = await readPersona(file);
  const parsed = categories.map(parseCategory);
  const unique = [...new Set([...(persona.categories ?? []), ...parsed])];
  const tagged: Persona = {
    ...persona,
    categories: unique,
    primaryCategory: primaryCategory ? parseCategory(primaryCategory) : persona.primaryCategory,
  };
  await writeFile(file, `${JSON.stringify(tagged, null, 2)}\n`);
  return tagged;
}

export async function loadFixturePersona(name: string): Promise<Persona> {
  return readPersona(join("fixtures", "personas", `${name}.json`));
}
