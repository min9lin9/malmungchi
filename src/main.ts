import { buildService } from "./bootstrap";
import { env } from "./config/env";
import { createHttpApp } from "./http/app";
import { createMcpServer } from "./mcp/server";
import { startHttpTransport } from "./transports/http";
import { startStdioTransport } from "./transports/stdio";
import { logger } from "./util/logger";

async function main() {
  const service = await buildService(env.dataDir, env.instanceName);
  await service.startSubscriptions();
  const shutdownHandlers: Array<() => Promise<void> | void> = [() => service.stopSubscriptions()];

  if (env.transport === "stdio") {
    const server = createMcpServer(service, {
      maxResponseChars: env.maxResponseChars,
    });
    await startStdioTransport(server);
    logger.info("Malmunchi MCP server running via stdio");
  }

  if (env.transport === "http") {
    const app = createHttpApp(service);
    const stopHttp = await startHttpTransport(app, env.httpPort, env.httpHost);
    shutdownHandlers.push(stopHttp);
    logger.info(`Malmunchi HTTP server running at http://${env.httpHost}:${env.httpPort}`);
  }

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
    for (const handler of shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        logger.error("Shutdown handler error", { error: String(error) });
      }
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (import.meta.main) {
  main().catch((error) => {
    logger.error("Server error", { error: String(error) });
    process.exit(1);
  });
}
