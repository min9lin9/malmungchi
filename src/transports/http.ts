import { open, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AnyElysia } from "elysia";

// ponytail: global HTTP lock; use per-data-dir locks only if isolated data directories must run side by side.
const DEFAULT_HTTP_LOCK_PATH = join(tmpdir(), "malmunchi-http.lock");

export async function startHttpTransport(
  app: AnyElysia,
  port: number,
  hostname: string,
  lockPath = DEFAULT_HTTP_LOCK_PATH
): Promise<() => Promise<void>> {
  const releaseLock = await acquireHttpLock(lockPath);
  let instance: AnyElysia;
  try {
    instance = app.listen({ port, hostname });
  } catch (error) {
    await releaseLock();
    throw error;
  }
  return async () => {
    try {
      await instance.stop();
    } finally {
      await releaseLock();
    }
  };
}

async function acquireHttpLock(lockPath: string): Promise<() => Promise<void>> {
  try {
    const file = await open(lockPath, "wx");
    try {
      await file.writeFile(`${process.pid}\n`);
    } finally {
      await file.close();
    }
  } catch (error) {
    if (!isNodeError(error) || error.code !== "EEXIST") throw error;
    const pid = await readLockedPid(lockPath);
    if (pid !== undefined && processIsAlive(pid)) {
      throw new Error(`Malmunchi HTTP server already running (pid ${pid})`);
    }
    await unlink(lockPath).catch((unlinkError: unknown) => {
      if (!isNodeError(unlinkError) || unlinkError.code !== "ENOENT") throw unlinkError;
    });
    return acquireHttpLock(lockPath);
  }
  return async () => {
    await unlink(lockPath).catch((error: unknown) => {
      if (!isNodeError(error) || error.code !== "ENOENT") throw error;
    });
  };
}

async function readLockedPid(lockPath: string): Promise<number | undefined> {
  const raw = await readFile(lockPath, "utf8").catch((error: unknown) => {
    if (isNodeError(error) && error.code === "ENOENT") return undefined;
    throw error;
  });
  if (raw === undefined) return undefined;
  const pid = Number.parseInt(raw.trim(), 10);
  return Number.isInteger(pid) && pid > 0 ? pid : undefined;
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ESRCH") return false;
    if (isNodeError(error) && error.code === "EPERM") return true;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
