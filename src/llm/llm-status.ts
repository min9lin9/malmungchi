import fs from "node:fs";
import path from "node:path";
import type { Env } from "../config/env";

export interface LlmStatus {
  provider: "openai" | "kimi";
  model: string;
  authenticated: boolean;
  authSource: "codex" | "env" | "login:openai";
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  quotaRemaining: number | null;
}

const diagnostics: Pick<
  LlmStatus,
  "lastSuccessAt" | "lastFailureAt" | "lastError" | "quotaRemaining"
> = {
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
  quotaRemaining: null,
};

export function recordLlmSuccess(quotaRemaining: number | null = null): void {
  diagnostics.lastSuccessAt = new Date().toISOString();
  diagnostics.quotaRemaining = quotaRemaining;
}

export function recordLlmFailure(error: unknown): void {
  diagnostics.lastFailureAt = new Date().toISOString();
  diagnostics.lastError = error instanceof Error ? error.message : String(error);
}

function readCodexOpenAiKey(authPath: string | undefined): string | null {
  if (!authPath) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(authPath, "utf-8")) as Record<string, unknown>;
    const key = parsed.OPENAI_API_KEY;
    return typeof key === "string" && key.length > 0 ? key : null;
  } catch {
    return null;
  }
}

function fallbackCodexAuthPath(): string {
  return path.join(process.env.HOME ?? "", ".codex", "auth.json");
}

export function resolveEmbeddingAuth(env?: Env): {
  apiKey?: string;
  source: "codex" | "env" | "login:openai";
} {
  const provider = env?.embeddingProvider ?? "openai";
  const codexKey =
    provider === "openai"
      ? (readCodexOpenAiKey(env?.codexAuthPath) ?? readCodexOpenAiKey(fallbackCodexAuthPath()))
      : null;
  const envKey = provider === "kimi" ? env?.kimiApiKey : env?.openaiApiKey;
  if (codexKey) return { apiKey: codexKey, source: "codex" };
  if (envKey) return { apiKey: envKey, source: "env" };
  return { source: "login:openai" };
}

export function getLlmStatus(env?: Env): LlmStatus {
  const provider = env?.embeddingProvider ?? "openai";
  const auth = resolveEmbeddingAuth(env);
  return {
    provider,
    model: env?.embeddingModel ?? "text-embedding-3-small",
    authenticated: auth.source !== "login:openai",
    authSource: auth.source,
    ...diagnostics,
  };
}
