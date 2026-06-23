import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Env } from "../src/config/env";
import { getLlmStatus } from "../src/llm/llm-status";

function env(overrides: Partial<Env>): Env {
  return {
    dataDir: "/tmp/data",
    episodesDir: "/tmp/data/documents",
    topicsDir: "/tmp/data/categories",
    blogsDir: "/tmp/data/blogs",
    authorsDir: "/tmp/data/authors",
    authorImportDir: "/tmp/data/imports",
    manifestPath: "/tmp/data/manifest.json",
    transport: "stdio",
    maxResults: 10,
    maxResponseChars: 1000,
    searchEngine: "flexsearch",
    httpHost: "127.0.0.1",
    httpPort: 3000,
    corpusName: "test",
    rateLimitRpm: 60,
    corsOrigin: "*",
    meiliHost: "http://localhost:7700",
    meiliIndexName: "test-index",
    openaiChatModel: "gpt-4o-mini",
    embeddingProvider: "openai",
    kimiBaseUrl: "https://api.moonshot.ai/v1",
    embeddingModel: "text-embedding-3-small",
    embeddingDimension: 1536,
    embeddingCacheDir: "/tmp/data/.cache/embeddings",
    codexAuthPath: "/tmp/missing-auth.json",
    ...overrides,
  };
}

describe("getLlmStatus", () => {
  it("reports Codex auth without exposing the key", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "codex-auth-"));
    const authPath = path.join(dir, "auth.json");
    await fs.writeFile(authPath, JSON.stringify({ OPENAI_API_KEY: "sk-secret" }), "utf-8");

    const status = getLlmStatus(env({ codexAuthPath: authPath }));

    expect(status.authenticated).toBe(true);
    expect(status.authSource).toBe("codex");
    expect(JSON.stringify(status)).not.toContain("sk-secret");

    await fs.rm(dir, { recursive: true, force: true });
  });

  it("uses KIMI env auth only when KIMI provider is selected", () => {
    const status = getLlmStatus(
      env({ embeddingProvider: "kimi", embeddingModel: "kimi-embedding", kimiApiKey: "kimi-key" })
    );

    expect(status.provider).toBe("kimi");
    expect(status.model).toBe("kimi-embedding");
    expect(status.authenticated).toBe(true);
    expect(status.authSource).toBe("env");
  });

  it("reports the login fallback when no embedding auth is configured", () => {
    const status = getLlmStatus(env({}));

    expect(status.authenticated).toBe(false);
    expect(status.authSource).toBe("login:openai");
  });
});
