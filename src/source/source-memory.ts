import fs from "node:fs/promises";
import path from "node:path";
import { isMissingPathError } from "../util/fs-errors";
import {
  compactSourceMemoryFile,
  readCompactionRecord,
  type SourceMemoryCompactionResult,
} from "./source-memory-compaction";

export type SourceAction = "import" | "delete" | "refresh";

export interface SourceMemoryEvent {
  readonly sourceId: string;
  readonly action: SourceAction;
  readonly at: string;
  readonly documentCount: number;
}

export interface SourceMemorySummary {
  readonly sourceId: string;
  readonly interactionCount: number;
  readonly lastAction: SourceAction;
  readonly lastSeenAt: string;
}

export interface SourceMemoryReadResult {
  readonly events: readonly SourceMemoryEvent[];
  readonly totalEvents: number;
  readonly malformedEventCount: number;
  readonly skippedMalformedEvents: number;
  readonly offset: number;
  readonly limit: number;
}

export interface SourceMemoryStatus {
  readonly sourceId: string;
  readonly eventCount: number;
  readonly malformedEventCount: number;
  readonly firstSeenAt?: string;
  readonly lastSeenAt?: string;
  readonly lastAction?: SourceAction;
  readonly compacted: boolean;
  readonly lastCompactedAt?: string;
  readonly retentionKeptEvents?: number;
  readonly skippedMalformedEvents?: number;
  readonly backupRetained?: boolean;
}

export class SourceMemory {
  constructor(private readonly filePath: string) {}

  static fromDataDir(dataDir: string): SourceMemory {
    return new SourceMemory(path.join(dataDir, ".cache", "source-memory.jsonl"));
  }

  async record(event: Omit<SourceMemoryEvent, "at">): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const entry: SourceMemoryEvent = { ...event, at: new Date().toISOString() };
    await fs.appendFile(this.filePath, `${JSON.stringify(entry)}\n`, "utf-8");
  }

  async summarize(): Promise<Map<string, SourceMemorySummary>> {
    const summaries = new Map<string, SourceMemorySummary>();
    for (const event of (await this.readEvents()).events) {
      const previous = summaries.get(event.sourceId);
      summaries.set(event.sourceId, {
        sourceId: event.sourceId,
        interactionCount: (previous?.interactionCount ?? 0) + 1,
        lastAction: event.action,
        lastSeenAt: event.at,
      });
    }
    return summaries;
  }

  async listEvents(sourceId?: string): Promise<SourceMemoryEvent[]> {
    return [...(await this.readEvents(sourceId)).events];
  }

  async readEvents(
    input?: string | { sourceId?: string; offset?: number; limit?: number }
  ): Promise<SourceMemoryReadResult> {
    const sourceId = typeof input === "string" ? input : input?.sourceId;
    const offset = Math.max(0, typeof input === "string" ? 0 : (input?.offset ?? 0));
    const limit =
      input === undefined || typeof input === "string"
        ? Number.MAX_SAFE_INTEGER
        : Math.max(0, Math.min(200, input.limit ?? 200));
    const raw = await readOptionalFile(this.filePath);
    const events: SourceMemoryEvent[] = [];
    let malformedEventCount = 0;
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const event = parseSourceMemoryEvent(line);
      if (!event) {
        malformedEventCount++;
        continue;
      }
      if (sourceId && event.sourceId !== sourceId) continue;
      events.push(event);
    }
    return {
      events: events.slice(offset, offset + limit),
      totalEvents: events.length,
      malformedEventCount,
      skippedMalformedEvents: malformedEventCount,
      offset,
      limit,
    };
  }

  async getStatus(sourceId: string): Promise<SourceMemoryStatus> {
    const read = await this.readEvents(sourceId);
    const first = read.events[0];
    const last = read.events.at(-1);
    const compaction = await readCompactionRecord(this.filePath, sourceId);
    return {
      sourceId,
      eventCount: read.events.length,
      malformedEventCount: read.malformedEventCount,
      firstSeenAt: first?.at,
      lastSeenAt: last?.at,
      lastAction: last?.action,
      compacted: compaction !== undefined,
      lastCompactedAt: compaction?.compactedAt,
      retentionKeptEvents: compaction?.retainedEvents,
      skippedMalformedEvents: compaction?.skippedMalformedEvents,
      backupRetained: compaction?.backupRetained,
    };
  }

  async getCompaction(sourceId: string) {
    return readCompactionRecord(this.filePath, sourceId);
  }

  async compactSource(sourceId: string): Promise<SourceMemoryCompactionResult> {
    return compactSourceMemoryFile({ filePath: this.filePath, sourceId });
  }
}

export function parseSourceMemoryEvent(line: string): SourceMemoryEvent | null {
  try {
    const parsed: unknown = JSON.parse(line);
    if (!isSourceMemoryRecord(parsed)) return null;
    if (parsed.action !== "import" && parsed.action !== "delete" && parsed.action !== "refresh") {
      return null;
    }
    return {
      sourceId: parsed.sourceId,
      action: parsed.action,
      at: parsed.at,
      documentCount: parsed.documentCount ?? 0,
    };
  } catch {
    return null;
  }
}

function isSourceMemoryRecord(value: unknown): value is {
  sourceId: string;
  action: string;
  at: string;
  documentCount?: number;
} {
  if (!isRecord(value)) return false;
  return (
    typeof value.sourceId === "string" &&
    typeof value.action === "string" &&
    typeof value.at === "string" &&
    (value.documentCount === undefined || typeof value.documentCount === "number")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

async function readOptionalFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if (isMissingPathError(error)) return "";
    throw error;
  }
}
