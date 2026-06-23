import { redactSecrets } from "./security.ts";

export const PROVIDER_NAMES = [
  "openai-compatible",
  "codex",
  "claude-code",
  "ollama",
  "fake",
] as const;

export type PersonaProviderName = (typeof PROVIDER_NAMES)[number];

export interface ProviderStatusOptions {
  readonly provider: string;
  readonly model?: string;
}

export interface ProviderStatus {
  readonly provider: PersonaProviderName;
  readonly model: string;
  readonly ready: boolean;
  readonly detail: string;
}

export function parsePersonaProvider(value: string): PersonaProviderName {
  if (value === "openai") return "openai-compatible";
  if (value === "claude") return "claude-code";
  const provider = PROVIDER_NAMES.find((name) => name === value);
  if (!provider) throw new Error(`Unknown provider: ${value}`);
  return provider;
}

export function providerStatus(options: ProviderStatusOptions): ProviderStatus {
  const provider = parsePersonaProvider(options.provider);
  const model = options.model ?? defaultModel(provider);
  if (provider === "fake" || provider === "ollama") {
    return {
      provider,
      model,
      ready: true,
      detail: "local provider configured",
    };
  }
  const envName =
    provider === "openai-compatible"
      ? "OPENAI_API_KEY"
      : provider === "codex"
        ? "CODEX_AUTH"
        : "CLAUDE_CODE_OAUTH";
  const ready = Boolean(process.env[envName]);
  return {
    provider,
    model,
    ready,
    detail: ready ? redactSecrets(`${envName}=${process.env[envName]}`) : `Missing ${envName}`,
  };
}

function defaultModel(provider: PersonaProviderName): string {
  switch (provider) {
    case "openai-compatible":
      return "gpt-5.5";
    case "codex":
      return "gpt-5.3-codex-spark";
    case "claude-code":
      return "claude-sonnet-4-6";
    case "ollama":
      return "llama3.2";
    case "fake":
      return "fake";
  }
}
