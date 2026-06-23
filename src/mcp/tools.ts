import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PodcastService } from "../service/podcast-service";
import { registerCoreTools } from "./tools.core";
import { registerSourceTools } from "./tools.sources";

export function registerTools(
  server: McpServer,
  service: PodcastService,
  maxResponseChars: number
): void {
  registerCoreTools(server, service, maxResponseChars);
  registerSourceTools(server, service, maxResponseChars);
}
