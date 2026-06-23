import { Elysia } from "elysia";
import type { PodcastService } from "../service/podcast-service";

export function statsRoutes(service: PodcastService) {
  return new Elysia({ prefix: "/stats" }).get("/", () => service.getStats());
}
