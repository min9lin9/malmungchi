import type { CorpusSource, ExportedSourceDocument, SourceHistoryResult } from "./source-types";

export function formatSourceMarkdown(
  source: CorpusSource,
  documents: readonly ExportedSourceDocument[],
  history: SourceHistoryResult | undefined,
  manifest?: {
    readonly documentSetChecksum: string;
    readonly bundleChecksum: string;
    readonly historyChecksum?: string;
    readonly provenanceChecksum: string;
  }
): string {
  const lines = [
    `# Exported Source: ${source.id}`,
    "",
    `- Type: ${source.type}`,
    `- Documents: ${documents.length}`,
    "",
  ];
  if (manifest) {
    lines.push(
      "## Manifest",
      "",
      `- Document set checksum: ${manifest.documentSetChecksum}`,
      `- Bundle checksum: ${manifest.bundleChecksum}`,
      `- Provenance checksum: ${manifest.provenanceChecksum}`
    );
    if (manifest.historyChecksum) {
      lines.push(`- History checksum: ${manifest.historyChecksum}`);
    }
    for (const document of documents) {
      lines.push(`- ${document.slug}: ${document.checksum}`);
    }
    lines.push("");
  }
  if (history) {
    lines.push("## History", "");
    for (const event of history.events) {
      lines.push(`- ${event.at}: ${event.action} (${event.documentCount} documents)`);
    }
    lines.push("");
  }
  for (const document of documents) {
    lines.push(`## ${document.slug}`, "", document.content, "");
  }
  return lines.join("\n");
}
