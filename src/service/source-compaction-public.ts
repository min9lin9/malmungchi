import path from "node:path";
import type { SourceMemoryCompactionRecord as InternalSourceMemoryCompactionRecord } from "../source/source-memory-compaction";
import type { CompactSourceMemoryResult, SourceMemoryCompactionRecord } from "./source-types";

export function toPublicCompaction(
  record: InternalSourceMemoryCompactionRecord | undefined
): SourceMemoryCompactionRecord | undefined {
  if (!record) return undefined;
  return {
    sourceId: record.sourceId,
    compactedAt: record.compactedAt,
    retainedEvents: record.retainedEvents,
    removedEvents: record.removedEvents,
    skippedMalformedEvents: record.skippedMalformedEvents,
    backupId: path.basename(record.backupPath),
    backupRetained: record.backupRetained,
  };
}

export function toCompactSourceMemoryResult(
  record: InternalSourceMemoryCompactionRecord
): CompactSourceMemoryResult {
  const publicRecord = toPublicCompaction(record);
  if (!publicRecord) throw new Error(`Missing compaction record for ${record.sourceId}`);
  return { ...publicRecord, compacted: true };
}
