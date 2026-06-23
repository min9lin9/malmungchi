import type { FileHandle } from "node:fs/promises";
import fs from "node:fs/promises";
import path from "node:path";
import { isMissingPathError, isNodeFsError } from "../util/fs-errors";
import { stableJson } from "../util/hash";

const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 30_000;

interface LockMetadata {
  readonly pid: number;
  readonly acquiredAt: string;
  readonly target: string;
}

export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lockPath = `${filePath}.lock`;
  const startedAt = Date.now();
  let handle: FileHandle | undefined;

  while (!handle) {
    try {
      handle = await fs.open(lockPath, "wx");
      await writeLockMetadata(handle, filePath);
    } catch (error) {
      if (!isNodeFsError(error) || error.code !== "EEXIST") throw error;
      await removeStaleLock(lockPath);
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error("Timed out waiting for source memory compaction lock");
      }
      await sleep(LOCK_RETRY_MS);
    }
  }

  try {
    return await fn();
  } finally {
    await handle.close().catch(() => undefined);
    await fs.rm(lockPath, { force: true }).catch(() => undefined);
  }
}

async function writeLockMetadata(handle: FileHandle, filePath: string): Promise<void> {
  const metadata: LockMetadata = {
    pid: process.pid,
    acquiredAt: new Date().toISOString(),
    target: path.basename(filePath),
  };
  await handle.writeFile(stableJson(metadata), "utf-8");
}

async function removeStaleLock(lockPath: string): Promise<void> {
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(lockPath);
  } catch (error) {
    if (isMissingPathError(error)) return;
    throw error;
  }
  if (Date.now() - stat.mtimeMs < LOCK_STALE_MS) return;
  const metadata = await readLockMetadata(lockPath);
  if (metadata && isProcessAlive(metadata.pid)) return;
  await fs.rm(lockPath, { force: true });
}

async function readLockMetadata(lockPath: string): Promise<LockMetadata | undefined> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(lockPath, "utf-8"));
    if (!isLockMetadata(parsed)) return;
    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError || isMissingPathError(error) || isNodeFsError(error)) return;
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  return !Array.isArray(value);
}

function isLockMetadata(value: unknown): value is LockMetadata {
  if (!isRecord(value)) return false;
  return (
    typeof value.pid === "number" &&
    typeof value.acquiredAt === "string" &&
    typeof value.target === "string"
  );
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (!isNodeFsError(error)) throw error;
    return error.code === "EPERM";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
