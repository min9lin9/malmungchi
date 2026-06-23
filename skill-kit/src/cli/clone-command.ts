import { exportCloneMarkdown, importCloneMarkdown } from "../clone-markdown.ts";
import { arg, has } from "./args.ts";

export async function handleCloneCommand(command: string): Promise<boolean> {
  if (command !== "clone") return false;
  const action = process.argv[3];
  if (action === "export") {
    const personaFile = process.argv[4];
    const out = arg("--out");
    if (!personaFile || !out)
      throw new Error("Usage: skill-kit clone export <persona-json> --out <dir>");
    await exportCloneMarkdown(personaFile, out, { force: has("--force") });
    console.log(`clone exported ${out}`);
    return true;
  }
  if (action === "import") {
    const cloneDir = process.argv[4];
    const out = arg("--out");
    if (!cloneDir || !out)
      throw new Error("Usage: skill-kit clone import <dir> --out <persona-json>");
    await importCloneMarkdown(cloneDir, out, { force: has("--force") });
    console.log(`clone imported ${out}`);
    return true;
  }
  throw new Error("Usage: skill-kit clone <export|import>");
}
