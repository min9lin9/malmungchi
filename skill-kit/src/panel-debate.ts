import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type CategoryLens, getCategoryLens } from "./category-lenses.ts";
import { readPersona } from "./persona.ts";

export interface DebateTurn {
  readonly round: number;
  readonly authorId: string;
  readonly text: string;
  readonly citation: unknown;
}

export interface DebateResult {
  readonly question: string;
  readonly rounds: number;
  readonly turns: readonly DebateTurn[];
  readonly moderatorSummary: {
    readonly agreements: readonly string[];
    readonly disagreements: readonly string[];
    readonly openQuestions: readonly string[];
    readonly sourceCaveats: readonly string[];
  };
  readonly markdown: string;
}

export interface PanelResult extends DebateResult {
  readonly category: string;
  readonly categoryLens: CategoryLens;
}

export interface RoomResult extends DebateResult {
  readonly mode: "stateless-room";
  readonly participants: readonly string[];
  readonly routing: {
    readonly selectedAuthorId: string;
    readonly reason: string;
  };
}

export async function runDebate(options: {
  personas: readonly string[];
  question: string;
  rounds: number;
  out: string;
  json?: string;
}): Promise<DebateResult> {
  if (options.personas.length < 1 || options.personas.length > 5)
    throw new Error("Debate requires 1-5 personas; maximum 5 personas");
  if (options.rounds < 1 || options.rounds > 5)
    throw new Error("Debate requires 1-5 rounds; maximum 5 rounds");
  const personas = await Promise.all(options.personas.map((file) => readPersona(file)));
  const turns = [];
  for (let round = 1; round <= options.rounds; round += 1) {
    for (const persona of personas) {
      const claim = persona.claims[0];
      if (!claim?.evidence[0]) throw new Error(`${persona.authorId} is missing citation evidence`);
      turns.push({
        round,
        authorId: persona.authorId,
        text: `${persona.authorId} answers "${options.question}" using ${claim.text}`,
        citation: claim.evidence[0],
      });
    }
  }
  const markdown = [
    `# Panel Debate`,
    "",
    `Question: ${options.question}`,
    "",
    ...turns.map(
      (turn) =>
        `## Round ${turn.round} - ${turn.authorId}\n${turn.text}\n\nCitation: ${turn.citation.sourceFile}:${turn.citation.lineStart}`
    ),
    "## Moderator Summary",
    "- Agreements: Ground responses in cited evidence.",
    "- Open questions: Collect more source material before stronger claims.",
  ].join("\n");
  const result: DebateResult = {
    question: options.question,
    rounds: options.rounds,
    turns,
    moderatorSummary: {
      agreements: ["Ground responses in cited evidence."],
      disagreements: [],
      openQuestions: ["Collect more source material before stronger claims."],
      sourceCaveats: personas.flatMap((persona) => persona.caveats),
    },
    markdown,
  };
  await writeFile(options.out, markdown);
  if (options.json) await writeFile(options.json, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

export async function runPanelByCategory(options: {
  personaDir: string;
  category: string;
  question: string;
  rounds: number;
  out: string;
  json?: string;
}): Promise<PanelResult> {
  const categoryLens = getCategoryLens(options.category);
  const entries = await readdir(options.personaDir, { withFileTypes: true });
  const personaFiles: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const file = join(options.personaDir, entry.name);
    const persona = await readPersona(file).catch(() => undefined);
    if (persona?.categories?.includes(options.category)) personaFiles.push(file);
  }
  if (personaFiles.length === 0)
    throw new Error(`No personas found for category: ${options.category}`);
  const debate = await runDebate({ ...options, personas: personaFiles });
  const markdown = [
    debate.markdown,
    "",
    "## Category Lens",
    `${categoryLens.label}: ${categoryLens.lens}`,
    `Always checks: ${categoryLens.alwaysChecks.join(", ")}`,
  ].join("\n");
  const result = {
    ...debate,
    markdown,
    category: options.category,
    categoryLens,
  };
  await writeFile(options.out, markdown);
  if (options.json) await writeFile(options.json, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

export async function runRoomAsk(options: {
  personas: readonly string[];
  question: string;
  out: string;
  json?: string;
}): Promise<RoomResult> {
  const debate = await runDebate({ ...options, rounds: 1 });
  const selectedAuthorId = debate.turns[0]?.authorId;
  if (!selectedAuthorId) throw new Error("Room requires at least one routed turn");
  const result: RoomResult = {
    ...debate,
    mode: "stateless-room",
    participants: debate.turns.map((turn) => turn.authorId),
    routing: {
      selectedAuthorId,
      reason: "first cited persona in stateless room",
    },
  };
  const markdown = [
    debate.markdown,
    "",
    "## Room Routing",
    `Selected: ${selectedAuthorId}`,
    "Reason: first cited persona in stateless room",
  ].join("\n");
  await writeFile(options.out, markdown);
  if (options.json) await writeFile(options.json, `${JSON.stringify(result, null, 2)}\n`);
  return { ...result, markdown };
}
