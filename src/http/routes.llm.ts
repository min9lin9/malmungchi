import { Elysia } from "elysia";
import type { DocumentService } from "../service/document-service";

export function llmRoutes(service: DocumentService) {
  return new Elysia({ prefix: "/llm" }).get("/status", () => service.getLlmStatus());
}
