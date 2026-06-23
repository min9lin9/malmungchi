import { afterEach, describe, expect, it } from "bun:test";
import { legacyEnvName } from "../src/config/env-names";
import { createHttpApp } from "../src/http/app";
import { buildFixtureDocumentService } from "./helpers/build-fixture-service";

async function buildApp() {
  const service = await buildFixtureDocumentService();
  return createHttpApp(service);
}

describe("http security", () => {
  afterEach(() => {
    delete process.env.CORPUS_CORS_ORIGIN;
    delete process.env.CORPUS_API_KEY;
    delete process.env[legacyEnvName("CORS_ORIGIN")];
    delete process.env[legacyEnvName("API_KEY")];
  });

  it("sets security headers", async () => {
    const app = await buildApp();
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("handles preflight OPTIONS", async () => {
    const app = await buildApp();
    const res = await app.handle(new Request("http://localhost/search", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });

  it("respects custom CORS origin", async () => {
    process.env.CORPUS_CORS_ORIGIN = "https://example.com";
    const app = await buildApp();
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });
});
