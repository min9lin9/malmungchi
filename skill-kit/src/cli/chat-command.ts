import { chatWithPersona } from "../chat.ts";
import { parseProvider } from "../llm.ts";
import { arg, has } from "./args.ts";

export async function handleChatCommand(command: string): Promise<boolean> {
  if (command !== "chat") return false;
  const personaFile = process.argv[3];
  if (!personaFile) throw new Error("Usage: skill-kit chat <persona-json> --prompt <text>");
  const result = await chatWithPersona({
    personaFile,
    prompt: arg("--prompt", "") ?? "",
    provider: parseProvider(arg("--provider", "fake")),
    out: arg("--out"),
    json: arg("--json"),
    historyDir: arg("--history-dir"),
    resume: arg("--resume"),
    noPersist: has("--no-persist"),
  });
  console.log(`chat written ${result.sessionId}`);
  return true;
}
