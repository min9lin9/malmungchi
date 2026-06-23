import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("prototype smoke script", () => {
  it("runs the prototype HTTP smoke path from the package script", async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "prototype-smoke-script-"));
    try {
      const first = await runSmoke(dataDir);
      expect(first.stdout).toContain("prototype smoke ok");
      expect(first.stdout).toContain("bundleChecksum");
      expect(first.stdout).toContain("compareSupported");

      const second = await runSmoke(dataDir);
      expect(second.stdout).toContain("prototype smoke ok");
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });
});

async function runSmoke(dataDir: string): Promise<{ readonly stdout: string }> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "smoke:prototype", "--data-dir", dataDir],
    stdout: "pipe",
    stderr: "pipe",
    cwd: process.cwd(),
    env: { ...process.env, MALMUNCHI_TRANSPORT: "http" },
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  expect(stderr).not.toContain("error:");
  expect(stderr).not.toContain("SmokeStepError");
  expect(exitCode).toBe(0);
  return { stdout };
}
