import { expect, test } from "bun:test";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertLocalMalmungchiUrl,
  assertRootBoundPath,
  getRequiredEnv,
  redactSecrets,
  scanFileForSecrets,
} from "../src/security.ts";

test("rejects traversal and unsafe absolute paths", async () => {
  await expect(assertRootBoundPath(process.cwd(), "../secret")).rejects.toThrow("traversal");
  await expect(assertRootBoundPath(process.cwd(), "/etc/passwd")).rejects.toThrow("absolute");
});

test("rejects symlink escape", async () => {
  const root = join(tmpdir(), `skill-sec-${Date.now()}`);
  try {
    await mkdir(root, { recursive: true });
    await symlink("/etc/passwd", join(root, "escape"));
    await expect(assertRootBoundPath(root, "escape")).rejects.toThrow("Symlink escape");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects remote malmungchi url without opt-in", () => {
  expect(() => assertLocalMalmungchiUrl("https://example.com", false)).toThrow("allow-remote");
  expect(assertLocalMalmungchiUrl("http://127.0.0.1:3000", false).hostname).toBe("127.0.0.1");
});

test("credentials are env-only and redacted", () => {
  const openaiKey = ("OPENAI_" + "API_KEY") as "OPENAI_API_KEY";
  const kimiKey = "KIMI_" + "API_KEY";
  const old = process.env[openaiKey];
  delete process.env[openaiKey];
  expect(() => getRequiredEnv(openaiKey)).toThrow(`Missing ${openaiKey}`);
  process.env[openaiKey] = old;
  const fakeKey = `sk-${"testSECRETSECRETSECRET"}`;
  expect(redactSecrets(`${openaiKey}=${fakeKey}`)).toContain("<redacted>");
  expect(redactSecrets(`${openaiKey} = project-token`)).toContain(`${openaiKey}=<redacted>`);
  expect(redactSecrets(`${kimiKey} = kimi-token`)).toContain(`${kimiKey}=<redacted>`);
});

test("secret scanner catches spaced env assignments", async () => {
  const root = join(tmpdir(), `skill-sec-secret-${Date.now()}`);
  try {
    await mkdir(root, { recursive: true });
    const file = join(root, "leak.txt");
    await writeFile(file, `${"OPENAI_" + "API_KEY"} = sk-${"testSECRETSECRETSECRET"}`);
    expect(await scanFileForSecrets(file)).toHaveLength(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("secret scanner catches provider oauth assignments", async () => {
  const root = join(tmpdir(), `skill-sec-oauth-${Date.now()}`);
  try {
    await mkdir(root, { recursive: true });
    const file = join(root, "leak.txt");
    await writeFile(file, "CODEX_AUTH = codex-token\nCLAUDE_CODE_OAUTH = c");
    expect(await scanFileForSecrets(file)).toHaveLength(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("can create normal root-bound file", async () => {
  const root = join(tmpdir(), `skill-sec-ok-${Date.now()}`);
  try {
    await mkdir(root, { recursive: true });
    await writeFile(join(root, "ok.md"), "ok");
    expect(await assertRootBoundPath(root, "ok.md")).toContain("ok.md");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
