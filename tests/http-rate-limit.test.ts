import { afterEach, describe, expect, it } from "bun:test";
import { createHttpApp } from "../src/http/app";
import { buildFixtureDocumentService } from "./helpers/build-fixture-service";

async function buildApp(rateLimitRpm: number) {
  const service = await buildFixtureDocumentService();
  return createHttpApp(service, { rateLimitRpm });
}

describe("http rate limit", () => {
  afterEach(() => {
    delete process.env.CORPUS_API_KEY;
  });

  it("allows requests under the limit", async () => {
    const app = await buildApp(3);
    const res1 = await app.handle(new Request("http://localhost/health"));
    const res2 = await app.handle(new Request("http://localhost/health"));
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });

  it("returns 429 when limit exceeded", async () => {
    const app = await buildApp(2);

    await app.handle(new Request("http://localhost/search?q=a"));
    await app.handle(new Request("http://localhost/search?q=b"));
    const res = await app.handle(new Request("http://localhost/search?q=c"));

    expect(res.status).toBe(429);
    const retry = res.headers.get("Retry-After");
    expect(retry).not.toBeNull();
    expect(Number(retry)).toBeGreaterThan(0);
  });

  it("tracks separate clients by x-forwarded-for", async () => {
    const app = await buildApp(1);

    const resA = await app.handle(
      new Request("http://localhost/search?q=a", {
        headers: { "X-Forwarded-For": "1.2.3.4" },
      })
    );
    const resB = await app.handle(
      new Request("http://localhost/search?q=b", {
        headers: { "X-Forwarded-For": "5.6.7.8" },
      })
    );

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
  });

  it("isolates request counters by app instance", async () => {
    const appA = await buildApp(1);
    const appB = await buildApp(1);

    expect((await appA.handle(new Request("http://localhost/health"))).status).toBe(200);
    expect((await appA.handle(new Request("http://localhost/health"))).status).toBe(429);
    expect((await appB.handle(new Request("http://localhost/health"))).status).toBe(200);
  });
});
