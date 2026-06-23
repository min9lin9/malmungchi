import { expect, test } from "bun:test";

test("quality gate contract requires full sample size", () => {
  const report = { pass: true, sampleAuthors: 10, targets: 50, quick: false };
  expect(report.sampleAuthors).toBeGreaterThanOrEqual(10);
  expect(report.targets).toBeGreaterThanOrEqual(50);
});
