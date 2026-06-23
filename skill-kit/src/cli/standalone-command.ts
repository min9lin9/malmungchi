import { cloneStatus, listClones, readHistorySummary } from "../standalone.ts";
import { arg } from "./args.ts";

export async function handleStandaloneCommand(command: string): Promise<boolean> {
  if (command === "list") {
    console.log((await listClones(arg("--clone-dir", ".") ?? ".")).join("\n"));
    return true;
  }
  if (command === "history") {
    console.log(await readHistorySummary(arg("--history-dir", ".") ?? "."));
    return true;
  }
  if (command === "status") {
    const cloneDir = arg("--clone-dir");
    if (cloneDir) {
      console.log(JSON.stringify(await cloneStatus(cloneDir), null, 2));
      return true;
    }
    throw new Error("Usage: skill-kit status --clone-dir <dir>");
  }
  return false;
}
