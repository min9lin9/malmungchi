import { expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { createHttpApp } from "../src/http/app";

export async function makePrototypeDataDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  await fs.mkdir(path.join(dir, "documents"), { recursive: true });
  await fs.mkdir(path.join(dir, "categories"), { recursive: true });
  await fs.mkdir(path.join(dir, "imports"), { recursive: true });
  return dir;
}

export async function importPrototypeAuthor(
  app: ReturnType<typeof createHttpApp>,
  authorId: string
): Promise<void> {
  const res = await app.handle(
    new Request("http://localhost/malmunchi/import-author", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        authorId,
        fileName: `${authorId}.md`,
        fileContent: "# Prototype Memory\n\noriginal prototype token",
      }),
    })
  );
  expect(res.status).toBe(200);
}
