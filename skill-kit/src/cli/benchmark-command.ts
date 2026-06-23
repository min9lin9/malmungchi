import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { evaluatePersonaBenchmark } from "../persona-benchmark.ts";
import { evaluateCorpusPersonaQuality } from "../persona-quality-benchmark.ts";
import { arg, has } from "./args.ts";

export async function handleBenchmarkCommand(command: string): Promise<boolean> {
  if (command !== "benchmark:persona") return false;
  const fixture = arg("--fixture", "fixtures/persona-benchmark") ?? "fixtures/persona-benchmark";
  const corpusUrl = arg("--corpus-url");
  const authorId = arg("--author-id");
  const out = arg("--out");
  const markdown = arg("--markdown");
  if (!out) throw new Error("Usage: skill-kit benchmark:persona --fixture <dir> --out <json>");
  const report = corpusUrl
    ? await evaluateCorpusPersonaQuality({
        corpusUrl,
        authorId: authorId ?? missingAuthorId(),
        allowRemote: has("--allow-remote-corpus"),
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
    | Awaited<ReturnType<typeof evaluateCorpusPersonaQuality>>
): string {
  const rows = Object.entries(report.dimensions).map(
    ([name, dimension]) => `- ${name}: ${dimension.pass ? "PASS" : "FAIL"} (${dimension.score})`
  );
  return ["# Persona Benchmark", "", ...rows, ""].join("\n");
}

function missingAuthorId(): never {
  throw new Error(
    "Usage: skill-kit benchmark:persona --corpus-url <url> --author-id <id> --out <json>"
  );
}
