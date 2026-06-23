import { afterEach, describe, expect, it } from "bun:test";
import path from "node:path";
import { createEnv } from "../src/config/env";
import { legacyEnvName } from "../src/config/env-names";

describe("env validation", () => {
  afterEach(() => {
    const names = [
      "CORPUS_API_KEY",
      "CORPUS_CORS_ORIGIN",
      "CORPUS_DATA_DIR",
      "CORPUS_HTTP_HOST",
      "CORPUS_HTTP_PORT",
      "CORPUS_IMPORT_DIR",
      "CORPUS_MAX_RESPONSE_CHARS",
      "CORPUS_MAX_RESULTS",
      "CORPUS_NAME",
      "CORPUS_RATE_LIMIT_RPM",
      "CORPUS_SEARCH_ENGINE",
      "CORPUS_TRANSPORT",
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
    process.env.CORPUS_HTTP_PORT = "8080";
    const env = createEnv();
    expect(env.httpPort).toBe(8080);
  });

  it("rejects negative port", () => {
    process.env.CORPUS_HTTP_PORT = "-1";
    expect(() => createEnv()).toThrow("CORPUS_HTTP_PORT");
  });

  it("rejects port above 65535", () => {
    process.env.CORPUS_HTTP_PORT = "70000";
    expect(() => createEnv()).toThrow("CORPUS_HTTP_PORT");
  });

  it("rejects non-numeric max results", () => {
    process.env.CORPUS_MAX_RESULTS = "abc";
    expect(() => createEnv()).toThrow("CORPUS_MAX_RESULTS");
  });

  it("rejects zero max results", () => {
    process.env.CORPUS_MAX_RESULTS = "0";
    expect(() => createEnv()).toThrow("CORPUS_MAX_RESULTS");
  });

  it("rejects invalid transport", () => {
    process.env.CORPUS_TRANSPORT = "both";
    expect(() => createEnv()).toThrow("Invalid CORPUS_TRANSPORT");
  });

  it("uses custom http host", () => {
    process.env.CORPUS_HTTP_HOST = "0.0.0.0";
    const env = createEnv();
    expect(env.httpHost).toBe("0.0.0.0");
  });

  it("uses custom author import directory", () => {
    process.env.CORPUS_IMPORT_DIR = "/tmp/corpus-imports";
    const env = createEnv();
    expect(env.authorImportDir).toBe(path.resolve("/tmp/corpus-imports"));
  });

  it("lets CORPUS variables override legacy variables", () => {
    process.env[legacyEnvName("HTTP_PORT")] = "8080";
    process.env.CORPUS_HTTP_PORT = "9090";
    const env = createEnv();
    expect(env.httpPort).toBe(9090);
  });

  it("keeps legacy variables as fallback compatibility", () => {
    process.env[legacyEnvName("HTTP_PORT")] = "8080";
    const env = createEnv();
    expect(env.httpPort).toBe(8080);
  });
});
