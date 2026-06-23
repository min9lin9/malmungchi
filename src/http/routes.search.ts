import { Elysia, t } from "elysia";
import { DATE_REGEX, DEFAULT_SEARCH_LIMIT, MAX_SEARCH_LIMIT } from "../config/constants";
import type { PodcastService } from "../service/podcast-service";

export function searchRoutes(service: PodcastService) {
  return new Elysia({ prefix: "/search" })
    .get(
      "/",
      async ({ query }) => {
        const result = await service.searchDocuments({
          query: query.q,
          limit: query.limit,
          offset: query.offset,
          page: query.page,
          topic: query.topic,
          guest: query.guest,
          fromDate: query.fromDate,
          toDate: query.toDate,
          rerank: query.rerank,
          rankingMode: query.rankingMode,
          explain: query.explain,
        });
        return result;
      },
      {
        query: t.Object({
          q: t.String({ minLength: 1 }),
          limit: t.Optional(
            t.Number({ default: DEFAULT_SEARCH_LIMIT, minimum: 1, maximum: MAX_SEARCH_LIMIT })
          ),
          offset: t.Optional(t.Number({ default: 0, minimum: 0 })),
          page: t.Optional(t.Number({ minimum: 1 })),
          topic: t.Optional(t.String()),
          guest: t.Optional(t.String()),
          fromDate: t.Optional(t.String({ pattern: DATE_REGEX.source })),
          toDate: t.Optional(t.String({ pattern: DATE_REGEX.source })),
          rerank: t.Optional(t.Boolean({ default: true })),
          rankingMode: t.Optional(t.Union([t.Literal("weighted"), t.Literal("rrf")])),
          explain: t.Optional(t.Boolean({ default: false })),
        }),
      }
    )
    .get(
      "/compare",
      async ({ query }) =>
        service.compareSearchExplanations({
          query: query.q,
          limit: query.limit,
          topic: query.topic,
          guest: query.guest,
          fromDate: query.fromDate,
          toDate: query.toDate,
        }),
      {
        query: t.Object({
          q: t.String({ minLength: 2 }),
          limit: t.Optional(
            t.Number({ default: DEFAULT_SEARCH_LIMIT, minimum: 1, maximum: MAX_SEARCH_LIMIT })
          ),
          topic: t.Optional(t.String()),
          guest: t.Optional(t.String()),
          fromDate: t.Optional(t.String({ pattern: DATE_REGEX.source })),
          toDate: t.Optional(t.String({ pattern: DATE_REGEX.source })),
        }),
      }
    );
}
