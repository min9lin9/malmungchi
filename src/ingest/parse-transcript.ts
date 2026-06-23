import matter from "gray-matter";
import type { DocumentMetadata, DocumentRecord } from "../domain/document";

function normalizeString(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const result = value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
    return result.length > 0 ? result : undefined;
  }
  return undefined;
}

export function parseTranscriptFile(slug: string, raw: string): DocumentRecord {
  const parsed = matter(raw);
  const data = parsed.data ?? {};

  const metadata: DocumentMetadata = {
    guest: normalizeString(data.guest),
    title: normalizeString(data.title),
    youtube_url: normalizeString(data.youtube_url),
    video_id: normalizeString(data.video_id),
    publish_date: normalizeString(data.publish_date),
    description: normalizeString(data.description),
    duration_seconds: normalizeNumber(data.duration_seconds),
    duration: normalizeString(data.duration),
    view_count: normalizeNumber(data.view_count),
    channel: normalizeString(data.channel),
    keywords: normalizeStringArray(data.keywords),
  };

  const content = parsed.content;
  const transcriptStart = content.indexOf("## Transcript");
  const transcript =
    transcriptStart >= 0 ? content.slice(transcriptStart + 13).trim() : content.trim();

  return {
    slug,
    metadata,
    content,
    transcript,
    wordCount: transcript.split(/\s+/).filter(Boolean).length,
  };
}
