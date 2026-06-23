import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createProvider, type ProviderName } from "./llm.ts";
import { readPersona } from "./persona.ts";

export interface ChatOptions {
  readonly personaFile: string;
  readonly prompt: string;
  readonly provider: ProviderName;
  readonly out?: string;
  readonly json?: string;
  readonly historyDir?: string;
  readonly resume?: string;
  readonly noPersist?: boolean;
}

export interface ChatTranscript {
  readonly sessionId: string;
  readonly authorId: string;
  readonly prompt: string;
  readonly answer: string;
  readonly markdown: string;
}

export async function chatWithPersona(options: ChatOptions): Promise<ChatTranscript> {
  if (!options.prompt) throw new Error("Usage: skill-kit chat <persona-json> --prompt <text>");
  const persona = await readPersona(options.personaFile);
  const provider = createProvider(options.provider);
  await provider.complete(`chat:${persona.authorId}:${options.prompt}`);
  const claim = persona.claims[0]?.text ?? "No grounded claim is available.";
  const name = persona.displayName ?? persona.authorId;
  const sessionId = options.resume ?? `session-${persona.authorId}`;
  if (!/^[A-Za-z0-9_-]+$/u.test(sessionId)) throw new Error(`Unsafe session id: ${sessionId}`);
  const answer = `${name}: ${claim}`;
  const markdown = [
    `# Chat: ${name}`,
    "",
    `Session: ${sessionId}`,
    "",
    `User: ${options.prompt}`,
    "",
    `Assistant: ${answer}`,
  ].join("\n");
  const transcript = {
    sessionId,
    authorId: persona.authorId,
    prompt: options.prompt,
    answer,
    markdown,
  };
  if (options.out) await writeFile(options.out, markdown);
  if (options.json) await writeFile(options.json, `${JSON.stringify(transcript, null, 2)}\n`);
  if (options.historyDir && !options.noPersist) {
    await mkdir(options.historyDir, { recursive: true });
    const file = join(options.historyDir, `${sessionId}.json`);
    const previous = await readHistory(file);
    await writeFile(file, `${JSON.stringify([...previous, transcript], null, 2)}\n`);
  }
  return transcript;
}

async function readHistory(file: string): Promise<readonly ChatTranscript[]> {
  const text = await readFile(file, "utf8").catch(() => "[]");
  const parsed: unknown = JSON.parse(text);
  return Array.isArray(parsed) ? (parsed as ChatTranscript[]) : [];
}
