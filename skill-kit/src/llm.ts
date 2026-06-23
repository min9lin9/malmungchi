import { type PersonaProviderName, parsePersonaProvider } from "./providers.ts";
import { getRequiredEnv } from "./security.ts";

export type ProviderName = PersonaProviderName | "openai" | "kimi";

export interface LlmProvider {
  name: ProviderName;
  complete(prompt: string): Promise<string>;
}

export function createProvider(name: ProviderName): LlmProvider {
  const parsedName = parseProvider(name);
  const providerName = parsedName === "openai" ? "openai-compatible" : parsedName;
  if (providerName === "fake") {
    return {
      name: providerName,
      async complete(prompt: string) {
        return JSON.stringify({
          provider: "fake",
          text: `fake:${prompt.slice(0, 24)}`,
        });
      },
    };
  }
  if (providerName === "openai-compatible") {
    getRequiredEnv("OPENAI_API_KEY");
    return {
      name: providerName,
      async complete() {
        return '{"provider":"openai-compatible"}';
      },
    };
  }
  if (providerName === "ollama") {
    return {
      name: providerName,
      async complete() {
        return '{"provider":"ollama"}';
      },
    };
  }
  if (providerName === "codex") {
    getConfiguredProviderEnv("CODEX_AUTH", "Codex OAuth");
    return staticProvider(providerName);
  }
  if (providerName === "claude-code") {
    getConfiguredProviderEnv("CLAUDE_CODE_OAUTH", "Claude Code OAuth");
    return staticProvider(providerName);
  }
  getRequiredEnv("KIMI_API_KEY");
  return {
    name,
    async complete() {
      return '{"provider":"kimi"}';
    },
  };
}

function staticProvider(name: ProviderName): LlmProvider {
  return {
    name,
    async complete() {
      return JSON.stringify({ provider: name });
    },
  };
}

function getConfiguredProviderEnv(name: string, label: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}; configure ${label} before use`);
  return value;
}

export function parseProvider(value: string | undefined): ProviderName {
  if (!value) return "openai";
  if (value === "kimi") return value;
  return parsePersonaProvider(value);
}
