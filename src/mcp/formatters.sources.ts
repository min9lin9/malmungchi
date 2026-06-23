import type {
  CompactSourceMemoryResult,
  DeleteSourceResult,
  ExportSourceResult,
  RefreshSourceResult,
  Source,
  SourceDetail,
  SourceHistoryResult,
  SourceStatusResult,
} from "../service/source-operations";

export function formatSources(sources: readonly Source[]): string {
  if (sources.length === 0) return "# Malmungchi Sources\n\nNo sources are loaded.";
  return [
    `# Malmungchi Sources (${sources.length})`,
    "",
    ...sources.map((source) =>
      [
        `## ${source.id}`,
        `- Type: ${source.type}`,
        `- Documents: ${source.documentCount}`,
        `- Interactions: ${source.interactionCount}`,
        source.lastAction ? `- Last action: ${source.lastAction}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    ),
  ].join("\n\n");
}

export function formatSourceDetail(detail: SourceDetail): string {
  return [
    `# Source: ${detail.source.id}`,
    "",
    `- Type: ${detail.source.type}`,
    `- Documents: ${detail.source.documentCount}`,
    "",
    ...detail.documents.map((document) => `- ${document.slug}: ${document.title}`),
  ].join("\n");
}

export function formatDeleteSourceResult(result: DeleteSourceResult): string {
  return [
    `# Deleted Source: ${result.sourceId}`,
    "",
    `- Documents removed: ${result.deletedDocuments}`,
    "",
    "The source has been removed from Malmungchi and the search index.",
  ].join("\n");
}

export function formatRefreshSourceResult(result: RefreshSourceResult): string {
  const documents = result.changes.documents ?? [];
  const lines = [
    `# Refreshed Source: ${result.sourceId}`,
    "",
    `- Status: ${result.status}`,
    `- Dry run: ${result.dryRun === true}`,
    `- Documents refreshed: ${result.refreshedDocuments}`,
    `- Added: ${result.added}`,
    `- Updated: ${result.updated}`,
    `- Skipped: ${result.skipped}`,
    `- Added slugs: ${result.changes.addedSlugs.join(", ") || "(none)"}`,
    `- Updated slugs: ${result.changes.updatedSlugs.join(", ") || "(none)"}`,
    `- Skipped slugs: ${result.changes.skippedSlugs.join(", ") || "(none)"}`,
  ];
  if (result.failures.length > 0) {
    lines.push("", "## Failures", "");
    for (const failure of result.failures) {
      lines.push(`- ${failure.stage}: ${failure.reason ?? "unknown"} - ${failure.message}`);
    }
  }
  if (documents.length > 0) {
    lines.push("", "## Document Changes", "");
    for (const change of documents) {
      lines.push(`- ${change.action}: ${change.slug} (${change.title})`);
    }
  }
  return lines.join("\n");
}

export function formatExportSourceResult(result: ExportSourceResult, maxChars: number): string {
  if (result.format === "markdown" && result.markdown) {
    return result.markdown.length > maxChars
      ? `${result.markdown.slice(0, maxChars)}\n\n...(truncated)`
      : result.markdown;
  }
  const lines = [
    `# Exported Source: ${result.source.id}`,
    "",
    `- Type: ${result.source.type}`,
    `- Documents: ${result.documents.length}`,
    `- Manifest version: ${result.manifest.version}`,
    `- Exported at: ${result.manifest.exportedAt}`,
    `- Content bytes: ${result.manifest.contentBytes}`,
    `- Checksum algorithm: ${result.manifest.checksumAlgorithm}`,
    `- Document set checksum: ${result.manifest.documentSetChecksum}`,
    `- Provenance checksum: ${result.manifest.provenanceChecksum}`,
    `- Bundle checksum: ${result.manifest.bundleChecksum}`,
    "",
  ];
  for (const document of result.documents) {
    lines.push(
      `## ${document.slug}`,
      "",
      `- Checksum: ${document.checksum}`,
      `- Content bytes: ${document.contentBytes}`,
      "",
      document.content,
      ""
    );
    const output = lines.join("\n");
    if (output.length > maxChars) return `${output.slice(0, maxChars)}\n\n...(truncated)`;
  }
  return lines.join("\n");
}

export function formatSourceHistory(result: SourceHistoryResult): string {
  const total = result.total ?? result.totalEvents ?? result.events.length;
  const malformed = result.malformedEventCount ?? result.skippedMalformedEvents ?? 0;
  const rangeStart = total === 0 || result.events.length === 0 ? 0 : result.offset + 1;
  const rangeEnd = result.events.length === 0 ? 0 : result.offset + result.events.length;
  const lines = [
    `# Source History: ${result.sourceId}`,
    "",
    `- Showing ${rangeStart}-${rangeEnd} of ${total} events`,
    `- Showing: ${result.events.length} of ${total}`,
    `- Offset: ${result.offset}`,
    `- Limit: ${result.limit}`,
    `- Malformed events skipped: ${malformed}`,
    `- Malformed events: ${malformed}`,
    result.lastCompaction
      ? `- Last compaction: ${result.lastCompaction.compactedAt} (${result.lastCompaction.sourceId})`
      : "",
    "",
  ].filter(Boolean);
  if (result.events.length === 0) {
    lines.push(
      total === 0 ? "No source memory events recorded." : "No source memory events on this page."
    );
    return lines.join("\n");
  }
  for (const event of result.events) {
    lines.push(`- ${event.at}: ${event.action} (${event.documentCount} documents)`);
  }
  return lines.join("\n");
}

export function formatSourceStatus(result: SourceStatusResult): string {
  return [
    `# Source Status: ${result.sourceId}`,
    "",
    `- Exists: ${result.exists}`,
    `- Active documents: ${result.activeDocumentCount}`,
    `- Memory events: ${result.memory.eventCount}`,
    `- Malformed events: ${result.memory.malformedEventCount}`,
    `- Compacted: ${result.memory.compacted}`,
    result.memory.lastCompactedAt ? `- Last compacted: ${result.memory.lastCompactedAt}` : "",
    result.memory.retentionKeptEvents !== undefined
      ? `- Retention kept events: ${result.memory.retentionKeptEvents}`
      : "",
    result.memory.backupRetained !== undefined
      ? `- Backup retained: ${result.memory.backupRetained}`
      : "",
    result.memory.lastAction ? `- Last action: ${result.memory.lastAction}` : "",
    result.memory.lastSeenAt ? `- Last seen: ${result.memory.lastSeenAt}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatCompactSourceMemoryResult(result: CompactSourceMemoryResult): string {
  return [
    `# Compacted Source Memory: ${result.sourceId}`,
    "",
    `- Compacted: ${result.compacted}`,
    `- Retained events: ${result.retainedEvents}`,
    `- Removed events: ${result.removedEvents}`,
    `- Malformed events skipped: ${result.skippedMalformedEvents}`,
    `- Backup retained: ${result.backupRetained}`,
    `- Backup ID: ${result.backupId}`,
    `- Compacted at: ${result.compactedAt}`,
  ].join("\n");
}
