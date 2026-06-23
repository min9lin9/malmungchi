import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export async function listClones(cloneDir: string): Promise<readonly string[]> {
  const entries = await readdir(cloneDir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function listHistory(historyDir: string): Promise<readonly string[]> {
  const entries = await readdir(historyDir).catch(() => []);
  return entries
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => entry.slice(0, -5))
    .sort();
}

export async function cloneStatus(cloneDir: string): Promise<{
  readonly cloneCount: number;
  readonly clones: readonly string[];
}> {
  const clones = await listClones(cloneDir);
  return { cloneCount: clones.length, clones };
}

export async function readHistorySummary(historyDir: string): Promise<string> {
  const sessions = await listHistory(historyDir);
  if (sessions.length === 0) return "no history";
  const rows = await Promise.all(
    sessions.map(async (session) => {
      const text = await readFile(join(historyDir, `${session}.json`), "utf8");
      const parsed: unknown = JSON.parse(text);
      const count = Array.isArray(parsed) ? parsed.length : 0;
      return `${session}\t${count}`;
    })
  );
  return rows.join("\n");
}
