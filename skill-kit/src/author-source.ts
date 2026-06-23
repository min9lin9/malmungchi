import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { loadElements } from "./provenance.ts";
import { assertLocalMalmungchiUrl, redactSecrets } from "./security.ts";

export async function generateAuthorJsonl(
  workspace: string,
  authorId: string,
  outFile: string
): Promise<string> {
  const elements = await loadElements(workspace);
  if (elements.length === 0) throw new Error("Invalid normalized folder: no elements found");
  await mkdir(dirname(outFile), { recursive: true });
  const lines = elements.map((element) =>
    JSON.stringify({
      authorId,
      tocKey: element.docId,
      title: element.sourceFile,
      content: element.text,
      metadata: {
        docId: element.docId,
        elementId: element.elementId,
        sourceFile: element.sourceFile,
        lineStart: element.lineStart,
        lineEnd: element.lineEnd,
      },
    })
  );
  const content = `${lines.join("\n")}\n`;
  await writeFile(outFile, content);
  return content;
}

export async function importAuthorHttp(options: {
  authorId: string;
  fileContent: string;
  malmungchiUrl: string;
  allowRemote: boolean;
}): Promise<unknown> {
  const url = assertLocalMalmungchiUrl(options.malmungchiUrl, options.allowRemote);
  const response = await fetch(new URL("/malmungchi/import-author", url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      authorId: options.authorId,
      fileName: `${options.authorId}.jsonl`,
      fileContent: options.fileContent,
      tocKey: "tocKey",
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Malmungchi import failed ${response.status}: ${redactSecrets(text)}`);
  }
  const parsed: unknown = JSON.parse(text);
  return parsed;
}
