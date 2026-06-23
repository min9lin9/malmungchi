import type { Env } from "../../config/env";
import { recordLlmFailure, recordLlmSuccess, resolveEmbeddingAuth } from "../../llm/llm-status";
import type { TextEmbeddingProvider } from "./embedding-reranker";

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
}

export class ApiEmbeddingProvider implements TextEmbeddingProvider {
  readonly provider: "openai" | "kimi";
  readonly model: string;
  readonly dimension: number;
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(env: Env) {
    this.provider = env.embeddingProvider;
    this.model = env.embeddingModel;
    this.dimension = env.embeddingDimension;
    this.apiKey = resolveEmbeddingAuth(env).apiKey;
    this.baseUrl =
      env.embeddingProvider === "kimi"
        ? env.kimiBaseUrl
        : (env.openaiBaseUrl ?? "https://api.openai.com/v1");
  }

  async embed(text: string): Promise<readonly number[]> {
    try {
      if (!this.apiKey) {
        throw new Error(`${this.provider} embedding auth is missing`);
      }
      const response = await fetch(`${this.baseUrl.replace(/\/$/u, "")}/embeddings`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          dimensions: this.provider === "openai" ? this.dimension : undefined,
        }),
      });
      const body = (await response.json()) as EmbeddingResponse;
      if (!response.ok) {
        throw new Error(body.error?.message ?? `Embedding request failed with ${response.status}`);
      }
      const embedding = body.data?.[0]?.embedding;
      if (!embedding || embedding.length === 0) {
        throw new Error("Embedding response did not include a vector");
      }
      recordLlmSuccess(null);
      return embedding;
    } catch (error) {
      recordLlmFailure(error);
      throw error;
    }
  }
}
