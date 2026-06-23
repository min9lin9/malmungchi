import { Elysia } from "elysia";
import type { DocumentService } from "../service/document-service";

export function statsRoutes(service: DocumentService) {
  return new Elysia({ prefix: "/stats" }).get("/", () => service.getStats());
}
