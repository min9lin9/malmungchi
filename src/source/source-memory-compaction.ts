import fs from "node:fs/promises";
import path from "node:path";
import { isMissingPathError } from "../util/fs-errors";
import { stableJson } from "../util/hash";
import type { SourceMemoryEvent } from "./source-memory";
import { parseSourceMemoryEvent } from "./source-memory";
import { withFileLock } from "./source-memory-lock";

export interface SourceMemoryCompactionRecord {
  readonly sourceId: string;
  readonly compactedAt: string;
  readonly retainedEvents: number;
  readonly removedEvents: number;
  readonly skippedMalformedEvents: number;
  readonly backupPath: string;
  readonly backupRetained: boolean;
}

export interface SourceMemoryCompactionResult extends SourceMemoryCompactionRecord {
  readonly compacted: true;
}

interface CompactionSidecar {
  readonly version: 1;
  readonly latestBySource: Record<string, SourceMemoryCompactionRecord>;
}

interface ParsedLine {
  readonly event: SourceMemoryEvent;
  readonly index: number;
}

export async function compactSourceMemoryFile(input: {
  readonly filePath: string;
  readonly sourceId: string;
  readonly keepLastPerSource?: number;
}): Promise<SourceMemoryCompactionResult> {
  return withFileLock(input.filePath, () => compactSourceMemoryFileUnlocked(input));
}

async function compactSourceMemoryFileUnlocked(input: {
  readonly filePath: string;
  readonly sourceId: string;
  readonly keepLastPerSource?: number;
}): Promise<SourceMemoryCompactionResult> {
  const keepLastPerSource = input.keepLastPerSource ?? 20;
  const raw = await readOptionalFile(input.filePath);
  const parsed = parseMemoryLines(raw);
  const sourceEvents = parsed.valid.filter((line) => line.event.sourceId === input.sourceId);
  const retainedSourceEvents = new Set(
    sourceEvents
      .slice(Math.max(0, sourceEvents.length - keepLastPerSource))
      .map((line) => line.index)
  );
  const retainedEvents = parsed.valid
    .filter(
      (line) => line.event.sourceId !== input.sourceId || retainedSourceEvents.has(line.index)
    )
    .map((line) => line.event);
  const backupPath = uniqueBackupPath(input.filePath);
  const tmpPath = `${input.filePath}.tmp-${process.pid}-${Date.now()}`;
  const compactedAt = new Date().toISOString();
  const record: SourceMemoryCompactionRecord = {
    sourceId: input.sourceId,
    compactedAt,
    retainedEvents: retainedSourceEvents.size,
    removedEvents: sourceEvents.length - retainedSourceEvents.size,
    skippedMalformedEvents: parsed.malformedCount,
    backupPath,
    backupRetained: true,
  };

  await fs.mkdir(path.dirname(input.filePath), { recursive: true });
  await writeVerifiedJsonl(tmpPath, retainedEvents);

  let swapped = false;
  try {
    await fs.writeFile(backupPath, raw, "utf-8");
    await fs.rename(tmpPath, input.filePath);
    swapped = true;
    await verifyJsonlFile(input.filePath);
    const previousBackupPath = await writeSidecar(input.filePath, record);
    if (previousBackupPath && previousBackupPath !== backupPath) {
      await fs.rm(previousBackupPath, { force: true });
    }
  } catch (error) {
    await fs.rm(tmpPath, { force: true }).catch(() => undefined);
    if (swapped) {
      await fs.copyFile(backupPath, input.filePath).catch(() => undefined);
    }
    throw error;
  }

  return { ...record, compacted: true };
}

export async function readCompactionRecord(
  filePath: string,
  sourceId: string
): Promise<SourceMemoryCompactionRecord | undefined> {
  const sidecar = await readSidecar(filePath);
  return sidecar.latestBySource[sourceId];
}

function parseMemoryLines(raw: string): {
  readonly valid: readonly ParsedLine[];
  readonly malformedCount: number;
} {
  const valid: ParsedLine[] = [];
  let malformedCount = 0;
  let index = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const event = parseSourceMemoryEvent(line);
    if (!event) {
      malformedCount++;
      continue;
    }
    valid.push({ event, index });
    index++;
  }
  return { valid, malformedCount };
}

async function writeVerifiedJsonl(filePath: string, events: readonly SourceMemoryEvent[]) {
  const content =
    events.length > 0 ? `${events.map((event) => JSON.stringify(event)).join("\n")}\n` : "";
  await fs.writeFile(filePath, content, "utf-8");
  await verifyJsonlFile(filePath);
}

async function verifyJsonlFile(filePath: string): Promise<void> {
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = parseMemoryLines(raw);
  if (parsed.malformedCount > 0) {
    throw new Error(`Compacted source memory contains ${parsed.malformedCount} malformed events`);
  }
}

async function writeSidecar(
  filePath: string,
  record: SourceMemoryCompactionRecord
): Promise<string | undefined> {
  const sidecarPath = sidecarFilePath(filePath);
  const current = await readSidecar(filePath);
  const previousBackupPath = current.latestBySource[record.sourceId]?.backupPath;
  const next: CompactionSidecar = {
    version: 1,
    latestBySource: {
      ...current.latestBySource,
      [record.sourceId]: record,
    },
  };
  const tmpPath = `${sidecarPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, stableJson(next), "utf-8");
  JSON.parse(await fs.readFile(tmpPath, "utf-8"));
  await fs.rename(tmpPath, sidecarPath);
  return previousBackupPath;
}

async function readSidecar(filePath: string): Promise<CompactionSidecar> {
  const sidecarPath = sidecarFilePath(filePath);
  let raw: string;
  try {
    raw = await fs.readFile(sidecarPath, "utf-8");
  } catch (error) {
    if (!isMissingPathError(error)) throw error;
    return { version: 1, latestBySource: {} };
  }
  const parsed: unknown = JSON.parse(raw);
  if (!isSidecar(parsed)) {
    throw new Error(`Invalid source memory compaction sidecar: ${sidecarPath}`);
  }
  return parsed;
}

function sidecarFilePath(filePath: string): string {
  return path.join(path.dirname(filePath), "source-memory.compaction.json");
}

function uniqueBackupPath(filePath: string): string {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${filePath}.${stamp}.bak`;
}

function isSidecar(value: unknown): value is CompactionSidecar {
  if (!isRecord(value)) return false;
  return value.version === 1 && isRecord(value.latestBySource);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

async function readOptionalFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if (isMissingPathError(error)) return "";
    throw error;
  }
}
