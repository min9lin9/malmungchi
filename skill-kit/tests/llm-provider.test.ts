import { expect, test } from "bun:test";
import { createProvider, parseProvider } from "../src/llm.ts";

test("fake provider is deterministic", async () => {
  expect(await createProvider("fake").complete("abcdef")).toContain("fake");
});

test("openai is default and missing key fails", () => {
  const envName = "OPENAI_" + "API_KEY";
  const old = process.env[envName];
  delete process.env[envName];
  expect(parseProvider(undefined)).toBe("openai");
  expect(() => createProvider("openai")).toThrow(envName);
  process.env[envName] = old;
});

test("kimi missing key fails clearly", () => {
  const envName = "KIMI_" + "API_KEY";
  const old = process.env[envName];
  delete process.env[envName];
  expect(() => createProvider("kimi")).toThrow(envName);
  process.env[envName] = old;
});
