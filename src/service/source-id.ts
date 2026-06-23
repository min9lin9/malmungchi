import fs from "node:fs/promises";
import path from "node:path";
import { InvalidInputError } from "../domain/errors";
import { isMissingPathError } from "../util/fs-errors";

const SOURCE_ENTITY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

export type MutableSourceKind = "author";

export interface ParsedMutableSourceId {
  readonly kind: MutableSourceKind;
  readonly entityId: string;
}

export function assertSourceId(sourceId: string): void {
  assertMutableSourceId(sourceId);
}

export function assertMutableSourceId(sourceId: string): ParsedMutableSourceId {
  const separator = sourceId.indexOf(":");
  if (separator === -1) {
    throw new InvalidInputError(`Invalid source ID: ${sourceId}`);
  }
  const kind = sourceId.slice(0, separator);
  const entityId = sourceId.slice(separator + 1);
  if (kind !== "author") {
    throw new InvalidInputError(`Unsupported source type: ${sourceId}`);
  }
  if (!SOURCE_ENTITY_ID_PATTERN.test(entityId)) {
    throw new InvalidInputError(`Invalid source ID: ${sourceId}`);
  }
  return { kind, entityId };
}

export function resolveContainedPath(rootDir: string, ...segments: readonly string[]): string {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(root, ...segments);
  if (!isPathInside(root, candidate)) {
    throw new InvalidInputError("Source path escapes the configured data directory");
  }
  return candidate;
}

export async function assertExistingPathContained(
  rootDir: string,
  candidatePath: string
): Promise<void> {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(candidatePath);
  if (!isPathInside(root, candidate)) {
    throw new InvalidInputError("Source path escapes the configured data directory");
  }
  try {
    const [rootReal, candidateReal] = await Promise.all([
      fs.realpath(rootDir),
      fs.realpath(candidatePath),
    ]);
    if (!isPathInside(rootReal, candidateReal)) {
      throw new InvalidInputError("Source path escapes the configured data directory");
    }
  } catch (error) {
    if (isMissingPathError(error)) return;
    throw error;
  }
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
