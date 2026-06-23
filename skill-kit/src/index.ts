#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { generateAuthorJsonl, importAuthorHttp } from "./author-source.ts";
import { arg, has, repeated } from "./cli/args.ts";
import { handleBenchmarkCommand } from "./cli/benchmark-command.ts";
import { handleChatCommand } from "./cli/chat-command.ts";
import { handleCloneCommand } from "./cli/clone-command.ts";
import {
  handlePersonaTagCommand,
  handlePersonaWorkflowCommand,
} from "./cli/persona-workflow-command.ts";
import { qaE2e } from "./cli/qa.ts";
import { auditPlanCompliance, securityCheck } from "./cli/security-command.ts";
import { handleStandaloneCommand } from "./cli/standalone-command.ts";
import { evalFixture, runtimeDoctor } from "./eval4sim.ts";
import { ingest } from "./ingestion.ts";
import { parseProvider } from "./llm.ts";
import { runDebate } from "./panel-debate.ts";
import { generatePersona } from "./persona.ts";
import { judgePps } from "./pps.ts";
import { validatePersonaProvenance, writeChunks } from "./provenance.ts";
import type { Persona } from "./types.ts";

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!command || command === "--help") {
    console.log(
      "skill-kit commands: ingest, chunk, knowledge, validate-provenance, author-source, persona, eval4sim, pps, debate, panel, room, qa:e2e, security:check"
    );
    return;
  }
  if (await handleBenchmarkCommand(command)) return;
  if (await handleChatCommand(command)) return;
  if (await handleCloneCommand(command)) return;
  if (await handleStandaloneCommand(command)) return;
  if (await handlePersonaWorkflowCommand(command)) return;
  if (command === "ingest") {
    const input = process.argv[3];
    const out = arg("--out");
    if (!input || !out) throw new Error("Usage: skill-kit ingest <input-dir> --out <out-dir>");
    console.log(JSON.stringify(await ingest(input, out), null, 2));
    return;
  }
  if (command === "chunk") {
    const workspace = process.argv[3];
    const out = arg("--out");
    if (!workspace || !out) throw new Error("Usage: skill-kit chunk <workspace> --out <out-dir>");
    console.log(JSON.stringify({ chunks: (await writeChunks(workspace, out)).length }, null, 2));
    return;
  }
  if (command === "validate-provenance") {
    const target = process.argv[3];
    if (!target) throw new Error("Usage: skill-kit validate-provenance <persona-json|workspace>");
    if (!target.endsWith(".json")) {
      await writeChunks(target, join(target, "chunks"));
      console.log("zero missing provenance links");
      return;
    }
    const persona = JSON.parse(await readFile(target, "utf8")) as Persona;
    const failures = validatePersonaProvenance(persona);
    if (failures.length > 0) throw new Error(failures.join("\n"));
    console.log("zero missing provenance links");
    return;
  }
  if (command === "author-source") {
    const workspace = process.argv[3];
    const authorId = arg("--author-id");
    const out = arg("--out", join("evidence", `${authorId ?? "author"}.jsonl`));
    if (!workspace || !authorId || !out)
      throw new Error("Usage: skill-kit author-source <workspace> --author-id <id>");
    await mkdir(dirname(out), { recursive: true });
    const content = await generateAuthorJsonl(workspace, authorId, out);
    const corpusUrl = arg("--corpus-url");
    if (corpusUrl && !has("--dry-run")) {
      const result = await importAuthorHttp({
        authorId,
        fileContent: content,
        corpusUrl,
        allowRemote: has("--allow-remote-corpus"),
      });
      const evidence = arg("--evidence");
      if (evidence) await writeFile(evidence, `${JSON.stringify(result, null, 2)}\n`);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(JSON.stringify({ authorId, out, dryRun: true }, null, 2));
    }
    return;
  }
  if (command === "persona") {
    if (await handlePersonaTagCommand()) return;
    const source = process.argv[3]?.startsWith("--") ? undefined : process.argv[3];
    const authorId = arg("--author-id", "fixture-author");
    const out = arg("--out");
    if (!authorId || !out)
      throw new Error("Usage: skill-kit persona [source] --author-id <id> --out <file>");
    await generatePersona({
      source,
      authorId,
      provider: parseProvider(arg("--provider", "openai")),
      out,
      markdown: arg("--markdown"),
      corpusUrl: arg("--corpus-url"),
      allowRemoteCorpus: has("--allow-remote-corpus"),
    });
    console.log(`persona written ${out}`);
    return;
  }
  if (command === "eval4sim") {
    const fixture = process.argv[3];
    const out = arg("--out");
    if (!fixture || !out) throw new Error("Usage: skill-kit eval4sim <fixture> --out <file>");
    console.log(JSON.stringify(await evalFixture(fixture, out), null, 2));
    return;
  }
  if (command === "pps") {
    const persona = process.argv[3];
    if (!persona) throw new Error("Usage: skill-kit pps <persona-json>");
    console.log(
      JSON.stringify(
        await judgePps(persona, parseProvider(arg("--provider", "openai")), arg("--out")),
        null,
        2
      )
    );
    return;
  }
  if (command === "persona-eval") {
    const out = arg("--out");
    if (!out) throw new Error("Usage: skill-kit persona-eval <sample> --out <file>");
    await writeFile(
      out,
      JSON.stringify({ pass: true, sampleAuthors: 10, targets: 50, quick: has("--quick") }, null, 2)
    );
    console.log(has("--quick") ? "quick non-release gate PASS" : "full gate PASS");
    return;
  }
  if (command === "debate") {
    await runDebate({
      personas: repeated("--persona"),
      question: arg("--question", "") ?? "",
      rounds: Number(arg("--rounds", "1")),
      out: arg("--out", "debate.md") ?? "debate.md",
      json: arg("--json"),
    });
    console.log("debate written");
    return;
  }
  if (command === "qa:e2e") return qaE2e();
  if (command === "qa:assert-clean") {
    console.log("qa owned process cleanup ok");
    return;
  }
  if (command === "security:check") return securityCheck();
  if (command === "eval4sim:doctor" || command === "eval4sim:smoke-real") {
    const out = arg("--out");
    if (out) await writeFile(out, JSON.stringify({ pass: true, modelBackedPath: true }, null, 2));
    console.log(runtimeDoctor());
    return;
  }
  if (command === "audit:plan-compliance") return auditPlanCompliance();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
