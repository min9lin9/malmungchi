import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Elysia } from "elysia";
import { env } from "../config/env";
import { createMcpServer } from "../mcp/server";
import type { PodcastService } from "../service/podcast-service";

export function mcpRoutes(service: PodcastService) {
  // Reuse the same MCP server instance across stateless HTTP requests.
  // Each request still gets a fresh transport, which is required by the SDK.
  const server = createMcpServer(service, {
    maxResponseChars: env.maxResponseChars,
  });

  return new Elysia({ prefix: "/mcp" }).all("/", async ({ request }) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(request);
    await server.close();
    return response;
  });
}
