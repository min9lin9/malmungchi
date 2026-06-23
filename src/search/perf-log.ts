import { logger } from "../util/logger";

export interface SearchTiming {
  query: string;
  elapsedMs: number;
  total: number;
  returned: number;
}

export const SLOW_QUERY_THRESHOLD_MS = 500;

export function logSearchTiming(timing: SearchTiming): void {
  const isSlow = timing.elapsedMs > SLOW_QUERY_THRESHOLD_MS;
  const meta = {
    query: timing.query,
    elapsedMs: Math.round(timing.elapsedMs * 100) / 100,
    total: timing.total,
    returned: timing.returned,
  };

  if (isSlow) {
    logger.warn("slow search query", meta);
  } else {
    logger.debug("search query", meta);
  }
}
