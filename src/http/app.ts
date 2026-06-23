import { Elysia } from "elysia";
import { DocumentNotFoundError, InvalidInputError, MalmungchiError } from "../domain/errors";
import type { DocumentService } from "../service/document-service";
import { logger } from "../util/logger";
import { checkApiKey } from "./auth";
import { recordRequest } from "./metrics";
import { createRateLimiter } from "./rate-limit";
import { healthRoutes } from "./routes.health";
import { llmRoutes } from "./routes.llm";
import { mcpRoutes } from "./routes.mcp";
import { metricsRoutes } from "./routes.metrics";
import { searchRoutes } from "./routes.search";
import { sourceRoutes } from "./routes.sources";
import { statsRoutes } from "./routes.stats";
import { applySecurityHeaders, getCorsOrigin } from "./security";

export interface HttpAppOptions {
  rateLimitRpm?: number;
}

function errorToStatus(error: Error): number {
  if (error instanceof DocumentNotFoundError) {
    return 404;
  }
  if (error instanceof InvalidInputError) {
    return 400;
  }
  if (error instanceof MalmungchiError) {
    return 400;
  }
  return 500;
}

export function createHttpApp(service: DocumentService, options: HttpAppOptions = {}) {
  const checkRateLimit = createRateLimiter({ limitRpm: options.rateLimitRpm });

  const app = new Elysia()
    .onRequest(({ request, set, store }) => {
      const path = new URL(request.url).pathname;
      applySecurityHeaders(set.headers, getCorsOrigin());

      if (request.method === "OPTIONS") {
        set.status = 204;
        return new Response(null, {
          status: 204,
          headers: new Headers(set.headers as Record<string, string>),
        });
      }

      const authError = checkApiKey(request, set, path);
      if (authError) {
        set.status = 401;
        return authError;
      }

      const rateLimitError = checkRateLimit(request, set);
      if (rateLimitError) {
        set.status = 429;
        return rateLimitError;
      }

      (store as Record<string, number>).requestStart = Date.now();
    })
    .onAfterResponse(({ request, set, store }) => {
      const start = (store as Record<string, number> | undefined)?.requestStart ?? Date.now();
      const durationMs = Math.round(Date.now() - start);
      const status = typeof set.status === "number" ? set.status : 200;
      recordRequest(status, durationMs);
      logger.info("HTTP request", {
        method: request.method,
        path: new URL(request.url).pathname,
        status,
        durationMs,
      });
    })
    .onError(({ code, error, set }) => {
      if (code === "VALIDATION") {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : String(error),
          code,
        };
      }

      const err = error instanceof Error ? error : new Error(String(error));
      set.status = errorToStatus(err);
      return {
        error: err.message,
        code: err instanceof MalmungchiError ? err.code : code,
      };
    })
    .use(healthRoutes(service))
    .use(metricsRoutes())
    .use(statsRoutes(service))
    .use(searchRoutes(service))
    .use(sourceRoutes(service))
    .use(llmRoutes(service))
    .use(mcpRoutes(service));

  return app;
}
