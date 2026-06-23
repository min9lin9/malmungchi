import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type BenchmarkDimension, evaluatePersonaBenchmark } from "../persona-benchmark.ts";
import { evaluateMalmungchiPersonaQuality } from "../persona-quality-benchmark.ts";
import { arg, has } from "./args.ts";

export async function handleBenchmarkCommand(command: string): Promise<boolean> {
  if (command !== "benchmark:persona") return false;
  const fixture = arg("--fixture", "fixtures/persona-benchmark") ?? "fixtures/persona-benchmark";
  const malmungchiUrl = arg("--malmungchi-url");
  const authorId = arg("--author-id");
  const out = arg("--out");
  const markdown = arg("--markdown");
  if (!out) throw new Error("Usage: skill-kit benchmark:persona --fixture <dir> --out <json>");
  const report = malmungchiUrl
    ? await evaluateMalmungchiPersonaQuality({
        malmungchiUrl,
        authorId: authorId ?? missingAuthorId(),
        allowRemote: has("--allow-remote-malmungchi"),
      })
    : await evaluatePersonaBenchmark(fixture);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  if (markdown) {
    await mkdir(dirname(markdown), { recursive: true });
    await writeFile(markdown, renderBenchmarkMarkdown(report));
  }
  if (!report.dimensions.overall.pass) throw new Error("persona benchmark FAIL");
  console.log(`persona benchmark ${report.dimensions.overall.pass ? "PASS" : "FAIL"}`);
  return true;
}

function renderBenchmarkMarkdown(
  report:
    | Awaited<ReturnType<typeof evaluatePersonaBenchmark>>
    | Awaited<ReturnType<typeof evaluateMalmungchiPersonaQuality>>
): string {
  const rows = Object.entries(report.dimensions).map(([name, dimension]) =>
    renderDimension(name, dimension)
  );
  return ["# Persona Benchmark", "", ...rows, ""].join("\n");
}

function renderDimension(name: string, dimension: BenchmarkDimension): string {
  return `- ${name}: ${dimension.pass ? "PASS" : "FAIL"} (${dimension.score})`;
}

function missingAuthorId(): never {
  throw new Error(
    "Usage: skill-kit benchmark:persona --malmungchi-url <url> --author-id <id> --out <json>"
  );
}
