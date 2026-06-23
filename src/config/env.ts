import path from "node:path";
import { legacyEnvName } from "./env-names";

export type TransportMode = "stdio" | "http";

export type SearchEngineType = "flexsearch" | "meilisearch";

export interface Env {
  dataDir: string;
  documentsDir: string;
  categoriesDir: string;
  blogsDir: string;
  authorsDir: string;
  authorImportDir: string;
  manifestPath: string;
  transport: TransportMode;
  maxResults: number;
  maxResponseChars: number;
  searchEngine: SearchEngineType;
  httpHost: string;
  httpPort: number;
  instanceName: string;
  apiKey?: string;
  rateLimitRpm: number;
  corsOrigin?: string;
  meiliHost: string;
  meiliApiKey?: string;
  meiliIndexName: string;
  insaneSearchRoot?: string;
  lightpandaCdpUrl?: string;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  openaiChatModel: string;
  codexAuthPath: string;
  kimiApiKey?: string;
  kimiBaseUrl: string;
  embeddingProvider: "openai" | "kimi";
  embeddingModel: string;
  embeddingDimension: number;
  embeddingCacheDir: string;
}

function getDataDir(): string {
  const raw = readEnv("MALMUNCHI_DATA_DIR", legacyEnvName("DATA_DIR")) ?? "./data";
  return path.resolve(raw);
}

function getTransport(): TransportMode {
  const raw = readEnv("MALMUNCHI_TRANSPORT", legacyEnvName("TRANSPORT")) ?? "stdio";
  if (raw !== "stdio" && raw !== "http") {
    throw new Error(`Invalid MALMUNCHI_TRANSPORT: ${raw}. Use "stdio" or "http".`);
  }
  return raw;
}

function getInt(
  name: string,
  fallback: number,
  options?: { min?: number; max?: number; legacyName?: string }
): number {
  const raw = readEnv(name, options?.legacyName);
  if (!raw) return fallback;
  const value = parseInt(raw, 10);
  if (Number.isNaN(value)) throw new Error(`Invalid ${name}: ${raw}`);
  if (options?.min !== undefined && value < options.min) {
    throw new Error(`${name} must be >= ${options.min}, got ${value}`);
  }
  if (options?.max !== undefined && value > options.max) {
    throw new Error(`${name} must be <= ${options.max}, got ${value}`);
  }
  return value;
}

function getHttpHost(): string {
  return readEnv("MALMUNCHI_HTTP_HOST", legacyEnvName("HTTP_HOST")) ?? "127.0.0.1";
}

function getSearchEngine(): SearchEngineType {
  const raw = readEnv("MALMUNCHI_SEARCH_ENGINE", legacyEnvName("SEARCH_ENGINE")) ?? "flexsearch";
  if (raw !== "flexsearch" && raw !== "meilisearch") {
    throw new Error(`Invalid MALMUNCHI_SEARCH_ENGINE: ${raw}. Use "flexsearch" or "meilisearch".`);
  }
  return raw;
}

function getEmbeddingProvider(): "openai" | "kimi" {
  const raw = process.env.EMBED_PROVIDER ?? "openai";
  if (raw !== "openai" && raw !== "kimi") {
    throw new Error(`Invalid EMBED_PROVIDER: ${raw}. Use "openai" or "kimi".`);
  }
  return raw;
}

function getCodexAuthPath(): string {
  if (process.env.OPENAI_AUTH_FILE) return process.env.OPENAI_AUTH_FILE;
  const configAuth = path.join(process.env.HOME ?? "", ".config", "openai", "auth.json");
  const codexHome = process.env.CODEX_HOME ?? path.join(process.env.HOME ?? "", ".codex");
  if (!process.env.CODEX_HOME) return configAuth;
  return path.join(codexHome, "auth.json");
}

function readEnv(name: string, legacyName?: string): string | undefined {
  return process.env[name] ?? (legacyName ? process.env[legacyName] : undefined);
}

export function createEnv(): Env {
  return {
    dataDir: getDataDir(),
    documentsDir: path.join(getDataDir(), "documents"),
    categoriesDir: path.join(getDataDir(), "categories"),
    blogsDir: path.join(getDataDir(), "blogs"),
    authorsDir: path.join(getDataDir(), "authors"),
    authorImportDir: path.resolve(
      readEnv("MALMUNCHI_IMPORT_DIR", legacyEnvName("IMPORT_DIR")) ??
        path.join(getDataDir(), "imports")
    ),
    manifestPath: path.join(getDataDir(), "manifest.json"),
    transport: getTransport(),
    maxResults: getInt("MALMUNCHI_MAX_RESULTS", 20, {
      min: 1,
      legacyName: legacyEnvName("MAX_RESULTS"),
    }),
    maxResponseChars: getInt("MALMUNCHI_MAX_RESPONSE_CHARS", 50000, {
      min: 1,
      legacyName: legacyEnvName("MAX_RESPONSE_CHARS"),
    }),
    searchEngine: getSearchEngine(),
    httpHost: getHttpHost(),
    httpPort: getInt("MALMUNCHI_HTTP_PORT", 3000, {
      min: 1,
      max: 65535,
      legacyName: legacyEnvName("HTTP_PORT"),
    }),
    instanceName: readEnv("MALMUNCHI_NAME", legacyEnvName("MALMUNCHI_NAME")) ?? "malmunchi",
    apiKey: readEnv("MALMUNCHI_API_KEY", legacyEnvName("API_KEY")),
    rateLimitRpm: getInt("MALMUNCHI_RATE_LIMIT_RPM", 60, {
      min: 1,
      legacyName: legacyEnvName("RATE_LIMIT_RPM"),
    }),
    corsOrigin: readEnv("MALMUNCHI_CORS_ORIGIN", legacyEnvName("CORS_ORIGIN")) ?? "*",
    meiliHost: process.env.MEILI_HOST ?? "http://localhost:7700",
    meiliApiKey: process.env.MEILI_API_KEY,
    meiliIndexName: process.env.MEILI_INDEX_NAME ?? "malmunchi",
    insaneSearchRoot: process.env.INSANE_SEARCH_ROOT,
    lightpandaCdpUrl: process.env.LIGHTPANDA_CDP_URL,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    openaiChatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
    codexAuthPath: getCodexAuthPath(),
    kimiApiKey: process.env.KIMI_API_KEY,
    kimiBaseUrl: process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1",
    embeddingProvider: getEmbeddingProvider(),
    embeddingModel: process.env.EMBED_MODEL ?? "text-embedding-3-small",
    embeddingDimension: getInt("EMBED_DIMENSION", 1536, { min: 1 }),
    embeddingCacheDir: path.join(getDataDir(), ".cache", "embeddings"),
  };
}

export const env = createEnv();
