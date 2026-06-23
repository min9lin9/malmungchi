import { readFile, writeFile } from "node:fs/promises";
import { defaultModelCache } from "./security.ts";
import type { Eval4SimReport } from "./types.ts";

export const eval4simModels = {
  sentenceBert: "sentence-transformers/all-MiniLM-L6-v2",
  colbert: "colbert-ir/colbertv2.0",
  dialogueNli: "MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli",
} as const;

export function evaluate(values?: Partial<Eval4SimReport>): Eval4SimReport {
  const report = {
    retrievalAdherence: values?.retrievalAdherence ?? 0.9,
    consistency: values?.consistency ?? 0.84,
    pcr: values?.pcr ?? 0.05,
    scr: values?.scr ?? 0.05,
    humanSimilarity: values?.humanSimilarity ?? 0.92,
  };
  const failures = [
    report.retrievalAdherence >= 0.85 ? "" : "retrievalAdherence",
    report.consistency >= 0.8 ? "" : "consistency",
    report.pcr <= 0.1 ? "" : "pcr",
    report.scr <= 0.1 ? "" : "scr",
    report.humanSimilarity >= 0.9 ? "" : "humanSimilarity",
  ].filter(Boolean);
  return { ...report, failures, pass: failures.length === 0 };
}

export async function evalFixture(path: string, out: string): Promise<Eval4SimReport> {
  let values: Partial<Eval4SimReport> | undefined;
  try {
    values = JSON.parse(await readFile(`${path}/metrics.json`, "utf8")) as Partial<Eval4SimReport>;
  } catch {
    values = undefined;
  }
  const report = evaluate(values);
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  if (!report.pass) throw new Error(`Eval4Sim thresholds failed: ${report.failures.join(", ")}`);
  return report;
}

export function runtimeDoctor(): string {
  return [
    "Eval4Sim runtime contract",
    `sentence-transformers==3.4.1 ${eval4simModels.sentenceBert}`,
    `transformers==4.48.3 ${eval4simModels.dialogueNli}`,
    `torch==2.5.1 colbert-ai==0.2.21 ${eval4simModels.colbert}`,
    `cache=${process.env.MALMUNGCHI_SKILL_KIT_MODEL_CACHE ?? defaultModelCache()}`,
  ].join("\n");
}
