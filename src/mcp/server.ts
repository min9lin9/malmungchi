import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentService } from "../service/document-service";
import { registerTools } from "./tools";

export function createMcpServer(
  service: DocumentService,
  options: { maxResponseChars: number }
): McpServer {
  const server = new McpServer({
    name: "malmungchi",
    version: "1.0.0",
  });

  registerTools(server, service, options.maxResponseChars);

  return server;
}
