import { Elysia } from "elysia";
import pkg from "../../package.json" with { type: "json" };
import type { PodcastService } from "../service/podcast-service";

const startTime = Date.now();

export function healthRoutes(service: PodcastService) {
  return new Elysia({ prefix: "/health" })
    .get("/", () => {
      const mem = process.memoryUsage();
      return {
        status: "ok",
        version: pkg.version,
        uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
        memoryMb: {
          rss: Math.round(mem.rss / 1024 / 1024),
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          external: Math.round(mem.external / 1024 / 1024),
        },
        stats: service.getStats(),
      };
    })
    .get("/ready", ({ set }) => {
      const readiness = service.getReadiness();
      if (!readiness.ready) {
        set.status = 503;
      }
      return readiness;
    });
}
