import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("readme documents implemented scripts", async () => {
  const readme = await readFile("README.md", "utf8");
  const index = await readFile("skill-kit/src/index.ts", "utf8");
  const packageJson = await readFile("package.json", "utf8");
  for (const command of ["qa:e2e", "security:check", "validate:skills", "eval4sim:doctor"]) {
    expect(readme).toContain(command);
  }
  expect(index).not.toContain("qa:with-malmungchi");
  expect(packageJson).not.toContain("qa:with-malmungchi");
});
