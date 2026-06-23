import { Elysia } from "elysia";
import type { PodcastService } from "../service/podcast-service";

export function llmRoutes(service: PodcastService) {
  return new Elysia({ prefix: "/llm" }).get("/status", () => service.getLlmStatus());
}
