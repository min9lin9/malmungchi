import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PodcastService } from "../service/podcast-service";
import { registerTools } from "./tools";

export function createMcpServer(
  service: PodcastService,
  options: { maxResponseChars: number }
): McpServer {
  const server = new McpServer({
    name: "malmunchi",
    version: "1.0.0",
  });

  registerTools(server, service, options.maxResponseChars);

  return server;
}
