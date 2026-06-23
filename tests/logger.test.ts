import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { logger } from "../src/util/logger";

describe("logger", () => {
  const originalError = console.error;
  let output: string[] = [];

  beforeEach(() => {
    output = [];
    console.error = (...args: unknown[]) => {
      output.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
  });

  afterEach(() => {
    console.error = originalError;
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;
  });

  it("filters messages below LOG_LEVEL", () => {
    process.env.LOG_LEVEL = "warn";
    logger.info("should not appear");
    logger.warn("should appear");
    expect(output.length).toBe(1);
    expect(output[0]).toContain("should appear");
  });

  it("outputs JSON when LOG_FORMAT=json", () => {
    process.env.LOG_LEVEL = "info";
    process.env.LOG_FORMAT = "json";
    logger.info("hello", { key: "value" });
    expect(output.length).toBe(1);
    const parsed = JSON.parse(output[0]);
    expect(parsed.message).toBe("hello");
    expect(parsed.key).toBe("value");
    expect(parsed.level).toBe("info");
  });

  it("defaults to info level", () => {
    delete process.env.LOG_LEVEL;
    logger.info("default info");
    expect(output.length).toBe(1);
    expect(output[0]).toContain("default info");
  });
});
