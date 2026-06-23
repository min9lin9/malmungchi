import { addKnowledge, parseKnowledgeSourceType } from "../knowledge.ts";
import { runPanelByCategory, runRoomAsk } from "../panel-debate.ts";
import { tagPersona } from "../persona.ts";
import { arg, repeated } from "./args.ts";

export async function handlePersonaWorkflowCommand(command: string): Promise<boolean> {
  if (command === "knowledge") {
    if (process.argv[3] !== "add")
      throw new Error(
        "Usage: skill-kit knowledge add <workspace> <file-or-folder> --source-label <label>"
      );
    const workspace = process.argv[4];
    const source = process.argv[5];
    const sourceLabel = arg("--source-label", "manual");
    if (!workspace || !source || !sourceLabel)
      throw new Error(
        "Usage: skill-kit knowledge add <workspace> <file-or-folder> --source-label <label>"
      );
    console.log(
      JSON.stringify(
        await addKnowledge({
          workspace,
          source,
          sourceLabel,
          category: arg("--category"),
          sourceType: parseKnowledgeSourceType(arg("--source-type")),
          publishedAt: arg("--published-at"),
        })
      )
    );
    return true;
  }
  if (command === "panel") {
    await runPanelByCategory({
      personaDir: arg("--persona-dir", ".") ?? ".",
      category: arg("--category", "") ?? "",
      question: arg("--question", "") ?? "",
      rounds: Number(arg("--rounds", "1")),
      out: arg("--out", "panel.md") ?? "panel.md",
      json: arg("--json"),
    });
    console.log("panel written");
    return true;
  }
  if (command === "room") {
    if (process.argv[3] !== "ask")
      throw new Error("Usage: skill-kit room ask --persona <file> --question <text> --out <file>");
    await runRoomAsk({
      personas: repeated("--persona"),
      question: arg("--question", "") ?? "",
      out: arg("--out", "room.md") ?? "room.md",
      json: arg("--json"),
    });
    console.log("room transcript written");
    return true;
  }
  return false;
}

export async function handlePersonaTagCommand(): Promise<boolean> {
  if (process.argv[3] !== "tag") return false;
  const file = process.argv[4];
  const categories = repeated("--category");
  if (!file || categories.length === 0)
    throw new Error("Usage: skill-kit persona tag <persona-json> --category <name>");
  console.log(
    JSON.stringify(await tagPersona(file, categories, arg("--primary-category")), null, 2)
  );
  return true;
}
