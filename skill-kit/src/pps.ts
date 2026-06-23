import { writeFile } from "node:fs/promises";
import { createProvider, type ProviderName } from "./llm.ts";
import { readPersona } from "./persona.ts";

export interface PpsReport {
  pass: boolean;
  average: number;
  factors: Record<string, number>;
  failures: string[];
}

export async function judgePps(
  personaFile: string,
  providerName: ProviderName,
  out?: string
): Promise<PpsReport> {
  const persona = await readPersona(personaFile);
  const provider = createProvider(providerName);
  await provider.complete(`pps:${persona.authorId}`);
  const weak = persona.caveats.length > 0 || persona.claims.length === 0;
  const factors = {
    consistency: weak ? 4.5 : 6,
    completeness: weak ? 3.5 : 6,
    credibility: weak ? 4 : 6,
    clarity: 6,
    willingnessToUse: weak ? 4 : 6,
    empathy: 6,
  };
  const scores = Object.values(factors);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const failures = [
    average >= 5.5 ? "" : "average",
    ...Object.entries(factors)
      .filter(([, score]) => score < 4)
      .map(([name]) => name),
  ].filter(Boolean);
  const report = { pass: failures.length === 0, average, factors, failures };
  if (out) await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  if (!report.pass) throw new Error(`PPS failed: ${failures.join(", ")}`);
  return report;
}
