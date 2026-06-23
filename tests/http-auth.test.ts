import { afterEach, describe, expect, it } from "bun:test";
import { legacyEnvName } from "../src/config/env-names";
import { createHttpApp } from "../src/http/app";
import { buildFixtureDocumentService } from "./helpers/build-fixture-service";

async function buildApp() {
  const service = await buildFixtureDocumentService();
  return createHttpApp(service);
}

describe("http auth", () => {
  afterEach(() => {
    delete process.env.CORPUS_API_KEY;
    delete process.env[legacyEnvName("API_KEY")];
  });

  it("allows public health endpoint without key", async () => {
    process.env.CORPUS_API_KEY = "secret";
    const app = await buildApp();
    const res = await app.handle(new Request("http://localhost/health"));
    expect(res.status).toBe(200);
  });

  it("rejects missing api key", async () => {
    process.env.CORPUS_API_KEY = "secret";
    const app = await buildApp();
    const res = await app.handle(new Request("http://localhost/search?q=test"));
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("Bearer");
  });

  it("accepts valid bearer token", async () => {
    process.env.CORPUS_API_KEY = "secret";
    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/search?q=test", {
        headers: { Authorization: "Bearer secret" },
      })
    );
    expect(res.status).toBe(200);
  });

  it("rejects invalid bearer token", async () => {
    process.env.CORPUS_API_KEY = "secret";
    const app = await buildApp();
    const res = await app.handle(
      new Request("http://localhost/search?q=test", {
        headers: { Authorization: "Bearer wrong" },
      })
    );
    expect(res.status).toBe(401);
  });

  it("does not require auth when api key is unset", async () => {
    delete process.env.CORPUS_API_KEY;
    delete process.env[legacyEnvName("API_KEY")];
    const app = await buildApp();
    const res = await app.handle(new Request("http://localhost/search?q=test"));
    expect(res.status).toBe(200);
  });
});
