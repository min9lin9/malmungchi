import { expect, test } from "bun:test";
import { eval4simModels, runtimeDoctor } from "../src/eval4sim.ts";
import { defaultModelCache } from "../src/security.ts";

test("pins model ids and external cache", () => {
  expect(eval4simModels.sentenceBert).toBe("sentence-transformers/all-MiniLM-L6-v2");
  expect(eval4simModels.dialogueNli).toContain("DeBERTa");
  expect(defaultModelCache()).not.toContain(process.cwd());
  expect(runtimeDoctor()).toContain("sentence-transformers==3.4.1");
});
