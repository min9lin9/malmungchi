import fs from "node:fs/promises";
import type { Env } from "../config/env";
import {
  assertExistingPathContained,
  assertMutableSourceId,
  resolveContainedPath,
} from "./source-id";

export async function removeSourceFiles(env: Env | undefined, sourceId: string): Promise<void> {
  if (!env) return;
  const parsed = assertMutableSourceId(sourceId);
  const sourceDir = resolveContainedPath(env.authorsDir, parsed.entityId);
  await assertExistingPathContained(env.authorsDir, sourceDir);
  await fs.rm(sourceDir, {
    recursive: true,
    force: true,
  });
}
