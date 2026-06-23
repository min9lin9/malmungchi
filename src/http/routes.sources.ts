import { Elysia, t } from "elysia";
import type { DocumentService } from "../service/document-service";

export function sourceRoutes(service: DocumentService) {
  return new Elysia({ prefix: "/corpus" })
    .get("/sources", async () => ({ sources: await service.listSources() }))
    .get(
      "/sources/:sourceId/status",
      async ({ params }) => service.getSourceStatus(params.sourceId),
      {
        params: t.Object({
          sourceId: t.String({ minLength: 1 }),
        }),
      }
    )
    .post(
      "/sources/:sourceId/refresh",
      async ({ params, query }) =>
        service.refreshSource({ sourceId: params.sourceId, dryRun: query.dryRun }),
      {
        params: t.Object({
          sourceId: t.String({ minLength: 1 }),
        }),
        query: t.Object({
          dryRun: t.Optional(t.Boolean({ default: false })),
        }),
      }
    )
    .post(
      "/sources/:sourceId/memory/compact",
      async ({ params }) => service.compactSourceMemory(params.sourceId),
      {
        params: t.Object({
          sourceId: t.String({ minLength: 1 }),
        }),
      }
    )
    .get(
      "/sources/:sourceId/export",
      async ({ params, query }) =>
        service.exportSource({
          sourceId: params.sourceId,
          format: query.format,
          includeHistory: query.includeHistory,
        }),
      {
        params: t.Object({
          sourceId: t.String({ minLength: 1 }),
        }),
        query: t.Object({
          format: t.Optional(t.Union([t.Literal("json"), t.Literal("markdown")])),
          includeHistory: t.Optional(t.Boolean({ default: false })),
        }),
      }
    )
    .get(
      "/sources/:sourceId/history",
      async ({ params, query }) =>
        service.getSourceHistory({
          sourceId: params.sourceId,
          offset: query.offset,
          limit: query.limit,
        }),
      {
        params: t.Object({
          sourceId: t.String({ minLength: 1 }),
        }),
        query: t.Object({
          offset: t.Optional(t.Number({ default: 0, minimum: 0 })),
          limit: t.Optional(t.Number({ default: 100, minimum: 0, maximum: 200 })),
        }),
      }
    )
    .get("/sources/:sourceId", async ({ params }) => service.getSource(params.sourceId), {
      params: t.Object({
        sourceId: t.String({ minLength: 1 }),
      }),
    })
    .delete("/sources/:sourceId", async ({ params }) => service.deleteSource(params.sourceId), {
      params: t.Object({
        sourceId: t.String({ minLength: 1 }),
      }),
    })
    .post(
      "/import-author",
      async ({ body }) =>
        service.importAuthor({
          filePath: body.filePath,
          fileContent: body.fileContent,
          fileName: body.fileName,
          authorId: body.authorId,
          splitBy: body.splitBy,
          tocKey: body.tocKey,
        }),
      {
        body: t.Object({
          filePath: t.Optional(t.String({ minLength: 1 })),
          fileContent: t.Optional(t.String({ minLength: 1 })),
          fileName: t.Optional(t.String({ minLength: 1 })),
          authorId: t.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
          splitBy: t.Optional(t.String({ minLength: 1 })),
          tocKey: t.Optional(t.String({ minLength: 1 })),
        }),
      }
    );
}
