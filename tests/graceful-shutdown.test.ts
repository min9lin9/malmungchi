import { describe, expect, it } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHttpApp } from "../src/http/app";
import { startHttpTransport } from "../src/transports/http";
import { buildFixtureDocumentService } from "./helpers/build-fixture-service";

async function testLockPath(): Promise<string> {
  return join(await mkdtemp(join(tmpdir(), "corpus-http-lock-")), "server.lock");
}

describe("graceful shutdown", () => {
  it("starts and stops HTTP server", async () => {
    const service = await buildFixtureDocumentService();
    const app = createHttpApp(service);
    const stop = await startHttpTransport(app, 0, "127.0.0.1", await testLockPath());

    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);

    await stop();
  });

  it("rejects a second HTTP server while one is running", async () => {
    const service = await buildFixtureDocumentService();
    const lockPath = await testLockPath();
    const stop = await startHttpTransport(createHttpApp(service), 0, "127.0.0.1", lockPath);
    let secondStop: (() => Promise<void>) | undefined;

    try {
      await expect(
        (async () => {
          secondStop = await startHttpTransport(createHttpApp(service), 0, "127.0.0.1", lockPath);
        })()
      ).rejects.toThrow("already running");
    } finally {
      if (secondStop) await secondStop();
      await stop();
    }
  });
});
