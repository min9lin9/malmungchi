import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evalFixture, evaluate } from "../src/eval4sim.ts";

test("reports pass and fail thresholds", () => {
  expect(evaluate().pass).toBe(true);
  expect(evaluate({ retrievalAdherence: 0.1 }).failures).toContain("retrievalAdherence");
});

test("fixture command fails on threshold violation", async () => {
  const out = await mkdtemp(join(tmpdir(), "eval-"));
  await expect(evalFixture("fixtures/eval4sim/fail", join(out, "report.json"))).rejects.toThrow(
    "retrievalAdherence"
  );
});
