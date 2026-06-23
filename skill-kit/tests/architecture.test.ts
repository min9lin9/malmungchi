import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { auditPlanCompliance } from "../src/cli/security-command.ts";

async function sourceFiles(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await sourceFiles(path)));
    } else if (entry.isFile() && path.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files;
}

function pureLoc(text: string): number {
  return text.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("#");
  }).length;
}

test("source files stay under the 250 pure LOC ceiling", async () => {
  const oversized: string[] = [];
  for (const file of await sourceFiles("skill-kit/src")) {
    const lines = pureLoc(await readFile(file, "utf8"));
    if (lines > 250) oversized.push(`${file}:${lines}`);
  }
  expect(oversized).toEqual([]);
});

test("project uses installed Bun/Node type definitions instead of local ambient shims", async () => {
  const files = await sourceFiles("skill-kit/src");
  expect(files).not.toContain("skill-kit/src/globals.d.ts");
});

test("audit plan compliance creates its evidence directory when missing", async () => {
  const originalCwd = process.cwd();
  const dir = await mkdtemp(join(tmpdir(), "skill-kit-audit-"));
  process.chdir(dir);
  try {
    await auditPlanCompliance();
    expect(await readFile("evidence/audit-plan-compliance.json", "utf8")).toContain('"pass": true');
  } finally {
    process.chdir(originalCwd);
    await rm(dir, { recursive: true, force: true });
  }
});
