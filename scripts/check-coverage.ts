import { $ } from "bun";

async function main() {
  const minimum = Number.parseFloat(process.env.COVERAGE_MIN ?? "85");
  const result = await $`bun test --coverage`.nothrow().quiet();
  const output = [result.stdout.toString(), result.stderr.toString()].join("\n");

  const lines: number[] = [];
  for (const row of output.split("\n")) {
    const match = row.match(/^\s*src\/\S+\s+\|\s+[\d.]+\s+\|\s+([\d.]+)\s+\|/);
    if (match) {
      lines.push(Number.parseFloat(match[1]));
    }
  }

  if (lines.length === 0) {
    console.error("Could not parse coverage output");
    process.exit(1);
  }

  const average = lines.reduce((a, b) => a + b, 0) / lines.length;
  console.log(`src/ average line coverage: ${average.toFixed(2)}%`);

  if (average < minimum) {
    console.error(`Coverage is below ${minimum}%`);
    process.exit(1);
  }

  if (hasFailedTests(output)) {
    console.error("Coverage run reported failing tests");
    printFailureExcerpt(output);
    process.exit(1);
  }

  if ((result.exitCode ?? 0) !== 0 && !hasZeroFailedTests(output)) {
    console.error(`Coverage run exited with code ${result.exitCode}`);
    printFailureExcerpt(output);
    process.exit(1);
  }

  process.exit(0);
}

main();

function hasFailedTests(output: string): boolean {
  return /^\s*[1-9]\d*\s+fail\b/m.test(output);
}

function hasZeroFailedTests(output: string): boolean {
  return /^\s*0\s+fail\b/m.test(output);
}

function printFailureExcerpt(output: string): void {
  const rows = output.split("\n");
  const interestingRows = rows
    .map((row, index) => ({ index, row }))
    .filter(({ row }) =>
      /\(fail\)|^error:|^\s*Expected:|^\s*Received:|^\s*[1-9]\d*\s+fail\b/.test(row)
    );

  if (interestingRows.length === 0) {
    console.error(rows.slice(-120).join("\n"));
    return;
  }

  const selected = new Set<number>();
  for (const { index } of interestingRows) {
    const start = Math.max(0, index - 12);
    const end = Math.min(rows.length - 1, index + 35);
    for (let i = start; i <= end; i += 1) {
      selected.add(i);
    }
  }

  console.error(
    [...selected]
      .sort((a, b) => a - b)
      .map((index) => rows[index])
      .join("\n")
  );
}
