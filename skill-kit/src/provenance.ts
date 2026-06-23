import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { readJsonl, writeJsonl } from "./fs-jsonl.ts";
import type { Chunk, EvidenceQuote, NormalizedElement, Persona } from "./types.ts";

export async function loadElements(workspace: string): Promise<NormalizedElement[]> {
  const normalized = join(workspace, "normalized");
  const docs = await readdir(normalized);
  const rows: NormalizedElement[] = [];
  for (const doc of docs.sort()) {
    rows.push(...(await readJsonl<NormalizedElement>(join(normalized, doc, "elements.jsonl"))));
  }
  return rows;
}

export function chunkElements(elements: readonly NormalizedElement[]): Chunk[] {
  return elements
    .filter((element) => element.text.trim().length > 0)
    .map((element, index) => ({
      docId: element.docId,
      elementId: element.elementId,
      chunkId: `${element.elementId}:c${index + 1}`,
      text: element.text,
      sourceFile: element.sourceFile,
      lineStart: element.lineStart,
      lineEnd: element.lineEnd,
    }));
}

export async function writeChunks(workspace: string, outDir: string): Promise<Chunk[]> {
  const chunks = chunkElements(await loadElements(workspace));
  await mkdir(outDir, { recursive: true });
  await writeJsonl(join(outDir, "chunks.jsonl"), chunks);
  return chunks;
}

export function evidenceFromChunk(chunk: Chunk): EvidenceQuote {
  return {
    quote: chunk.text,
    chunkId: chunk.chunkId,
    elementId: chunk.elementId,
    docId: chunk.docId,
    sourceFile: chunk.sourceFile,
    lineStart: chunk.lineStart,
    lineEnd: chunk.lineEnd,
  };
}

export function validatePersonaProvenance(persona: Persona): string[] {
  const failures: string[] = [];
  for (const claim of persona.claims) {
    if (claim.evidence.length === 0) failures.push(`${claim.id}: missing evidence`);
    for (const evidence of claim.evidence) {
      if (!evidence.quote) failures.push(`${claim.id}: missing quote`);
      if (!evidence.chunkId) failures.push(`${claim.id}: missing chunkId`);
      if (!evidence.elementId) failures.push(`${claim.id}: missing elementId`);
      if (!evidence.docId) failures.push(`${claim.id}: missing docId`);
      if (!evidence.sourceFile) failures.push(`${claim.id}: missing sourceFile`);
    }
  }
  return failures;
}
