import { lstat, readFile, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

const authHeaderName = "Authorization";
const bearerPrefix = "Bearer";

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  new RegExp(`${authHeaderName}:\\s*${bearerPrefix}\\s+\\S+`, "i"),
  /(access_token|refresh_token)=\S+/i,
  /(^|\s)OPENAI_API_KEY\s*=\s*[^<\s]+/,
  /(^|\s)KIMI_API_KEY\s*=\s*[^<\s]+/,
  /(^|\s)CODEX_AUTH\s*=\s*[^<\s]+/,
  /(^|\s)CLAUDE_CODE_OAUTH\s*=\s*[^<\s]+/,
];

export function redactSecrets(text: string): string {
  return text
    .replace(
      new RegExp(`${authHeaderName}:\\s*${bearerPrefix}\\s+\\S+`, "gi"),
      `${authHeaderName}: ${bearerPrefix} <redacted>`
    )
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "<redacted>")
    .replace(/(access_token|refresh_token)=([^\s]+)/gi, "$1=<redacted>")
    .replace(
      /(OPENAI_API_KEY|KIMI_API_KEY|CODEX_AUTH|CLAUDE_CODE_OAUTH)\s*=\s*([^\s]+)/g,
      "$1=<redacted>"
    )
    .replace(/\/\/([^:\s]+):([^@\s]+)@/g, "//<redacted>:<redacted>@");
}

export function safeCategorySlug(category: string): string {
  if (/(\.\.|[/\\\p{Cc}])/u.test(category)) {
    throw new Error(`Unsafe category: ${category}`);
  }
  const slug = category.trim().replace(/\s+/g, "-");
  if (!slug) throw new Error("Unsafe category: empty");
  return slug;
}

export async function assertRootBoundPath(root: string, candidate: string): Promise<string> {
  if (candidate.includes("..")) {
    throw new Error(`Unsafe path traversal rejected: ${candidate}`);
  }
  if (isAbsolute(candidate) && !resolve(candidate).startsWith(resolve(root))) {
    throw new Error(`Unsafe absolute path rejected: ${candidate}`);
  }
  const full = resolve(root, candidate);
  const rootReal = await realpath(root);
  const stat = await lstat(full);
  const fullReal = stat.isSymbolicLink() ? await realpath(full) : await realpath(full);
  const rel = relative(rootReal, fullReal);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Symlink escape rejected: ${candidate}`);
  }
  return fullReal;
}

export function assertLocalMalmungchiUrl(urlText: string, allowRemote: boolean): URL {
  const url = new URL(urlText);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (!allowRemote && !localHosts.has(url.hostname)) {
    throw new Error(`Remote Malmungchi URL requires --allow-remote-malmungchi: ${url.origin}`);
  }
  return url;
}

export function getRequiredEnv(name: "OPENAI_API_KEY" | "KIMI_API_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}; configure it via environment or Codex secret flow`);
  return value;
}

export function defaultModelCache(): string {
  const base = process.env.XDG_CACHE_HOME ?? `${process.env.HOME ?? "."}/.cache`;
  return `${base}/malmungchi/models`;
}

export async function scanFileForSecrets(file: string): Promise<string[]> {
  const text = await readFile(file, "utf8");
  return secretPatterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}
