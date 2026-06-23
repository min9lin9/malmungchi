import { afterEach, describe, expect, it } from "bun:test";
import path from "node:path";
import { createEnv } from "../src/config/env";
import { legacyEnvName } from "../src/config/env-names";

describe("env validation", () => {
  afterEach(() => {
    const names = [
      "MALMUNGCHI_API_KEY",
      "MALMUNGCHI_CORS_ORIGIN",
      "MALMUNGCHI_DATA_DIR",
      "MALMUNGCHI_HTTP_HOST",
      "MALMUNGCHI_HTTP_PORT",
      "MALMUNGCHI_IMPORT_DIR",
      "MALMUNGCHI_MAX_RESPONSE_CHARS",
      "MALMUNGCHI_MAX_RESULTS",
      "MALMUNGCHI_NAME",
      "MALMUNGCHI_RATE_LIMIT_RPM",
      "MALMUNGCHI_SEARCH_ENGINE",
      "MALMUNGCHI_TRANSPORT",
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
    process.env.MALMUNGCHI_HTTP_PORT = "8080";
    const env = createEnv();
    expect(env.httpPort).toBe(8080);
  });

  it("rejects negative port", () => {
    process.env.MALMUNGCHI_HTTP_PORT = "-1";
    expect(() => createEnv()).toThrow("MALMUNGCHI_HTTP_PORT");
  });

  it("rejects port above 65535", () => {
    process.env.MALMUNGCHI_HTTP_PORT = "70000";
    expect(() => createEnv()).toThrow("MALMUNGCHI_HTTP_PORT");
  });

  it("rejects non-numeric max results", () => {
    process.env.MALMUNGCHI_MAX_RESULTS = "abc";
    expect(() => createEnv()).toThrow("MALMUNGCHI_MAX_RESULTS");
  });

  it("rejects zero max results", () => {
    process.env.MALMUNGCHI_MAX_RESULTS = "0";
    expect(() => createEnv()).toThrow("MALMUNGCHI_MAX_RESULTS");
  });

  it("rejects invalid transport", () => {
    process.env.MALMUNGCHI_TRANSPORT = "both";
    expect(() => createEnv()).toThrow("Invalid MALMUNGCHI_TRANSPORT");
  });

  it("uses custom http host", () => {
    process.env.MALMUNGCHI_HTTP_HOST = "0.0.0.0";
    const env = createEnv();
    expect(env.httpHost).toBe("0.0.0.0");
  });

  it("uses custom author import directory", () => {
    process.env.MALMUNGCHI_IMPORT_DIR = "/tmp/malmungchi-imports";
    const env = createEnv();
    expect(env.authorImportDir).toBe(path.resolve("/tmp/malmungchi-imports"));
  });

  it("lets MALMUNGCHI variables override legacy variables", () => {
    process.env[legacyEnvName("HTTP_PORT")] = "8080";
    process.env.MALMUNGCHI_HTTP_PORT = "9090";
    const env = createEnv();
    expect(env.httpPort).toBe(9090);
  });

  it("keeps legacy variables as fallback compatibility", () => {
    process.env[legacyEnvName("HTTP_PORT")] = "8080";
    const env = createEnv();
    expect(env.httpPort).toBe(8080);
  });
});
