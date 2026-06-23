import { Elysia } from "elysia";
import { renderPrometheusMetrics } from "./metrics";

export function metricsRoutes() {
  return new Elysia({ prefix: "/metrics" }).get("/", () => {
    return new Response(renderPrometheusMetrics(), {
      headers: { "Content-Type": "text/plain; version=0.0.4" },
    });
  });
}
