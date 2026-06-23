import { afterEach, describe, expect, it } from "bun:test";
import path from "node:path";
import { createEnv } from "../src/config/env";
import { legacyEnvName } from "../src/config/env-names";

describe("env validation", () => {
  afterEach(() => {
    const names = [
      "MALMUNCHI_API_KEY",
      "MALMUNCHI_CORS_ORIGIN",
      "MALMUNCHI_DATA_DIR",
      "MALMUNCHI_HTTP_HOST",
      "MALMUNCHI_HTTP_PORT",
      "MALMUNCHI_IMPORT_DIR",
      "MALMUNCHI_MAX_RESPONSE_CHARS",
      "MALMUNCHI_MAX_RESULTS",
      "MALMUNCHI_NAME",
      "MALMUNCHI_RATE_LIMIT_RPM",
      "MALMUNCHI_SEARCH_ENGINE",
      "MALMUNCHI_TRANSPORT",
      ..."HTTP_HOST HTTP_PORT IMPORT_DIR MAX_RESPONSE_CHARS MAX_RESULTS TRANSPORT"
        .split(" ")
        .map(legacyEnvName),
    ];
    for (const name of names) {
      delete process.env[name];
    }
  });

  it("uses defaults", () => {
    const env = createEnv();
    expect(env.transport).toBe("stdio");
    expect(env.httpHost).toBe("127.0.0.1");
    expect(env.httpPort).toBe(3000);
    expect(env.maxResults).toBe(20);
    expect(env.maxResponseChars).toBe(50000);
  });

  it("accepts valid http port", () => {
    process.env.MALMUNCHI_HTTP_PORT = "8080";
    const env = createEnv();
    expect(env.httpPort).toBe(8080);
  });

  it("rejects negative port", () => {
    process.env.MALMUNCHI_HTTP_PORT = "-1";
    expect(() => createEnv()).toThrow("MALMUNCHI_HTTP_PORT");
  });

  it("rejects port above 65535", () => {
    process.env.MALMUNCHI_HTTP_PORT = "70000";
    expect(() => createEnv()).toThrow("MALMUNCHI_HTTP_PORT");
  });

  it("rejects non-numeric max results", () => {
    process.env.MALMUNCHI_MAX_RESULTS = "abc";
    expect(() => createEnv()).toThrow("MALMUNCHI_MAX_RESULTS");
  });

  it("rejects zero max results", () => {
    process.env.MALMUNCHI_MAX_RESULTS = "0";
    expect(() => createEnv()).toThrow("MALMUNCHI_MAX_RESULTS");
  });

  it("rejects invalid transport", () => {
    process.env.MALMUNCHI_TRANSPORT = "both";
    expect(() => createEnv()).toThrow("Invalid MALMUNCHI_TRANSPORT");
  });

  it("uses custom http host", () => {
    process.env.MALMUNCHI_HTTP_HOST = "0.0.0.0";
    const env = createEnv();
    expect(env.httpHost).toBe("0.0.0.0");
  });

  it("uses custom author import directory", () => {
    process.env.MALMUNCHI_IMPORT_DIR = "/tmp/malmunchi-imports";
    const env = createEnv();
    expect(env.authorImportDir).toBe(path.resolve("/tmp/malmunchi-imports"));
  });

  it("lets MALMUNCHI variables override legacy variables", () => {
    process.env[legacyEnvName("HTTP_PORT")] = "8080";
    process.env.MALMUNCHI_HTTP_PORT = "9090";
    const env = createEnv();
    expect(env.httpPort).toBe(9090);
  });

  it("keeps legacy variables as fallback compatibility", () => {
    process.env[legacyEnvName("HTTP_PORT")] = "8080";
    const env = createEnv();
    expect(env.httpPort).toBe(8080);
  });
});
