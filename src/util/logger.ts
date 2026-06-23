export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function parseLogLevel(raw: string | undefined): LogLevel {
  switch (raw?.toLowerCase()) {
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
    case "warning":
      return "warn";
    case "error":
      return "error";
    case "silent":
      return "error";
    default:
      return "info";
  }
}

function isJsonFormat(): boolean {
  return process.env.LOG_FORMAT?.toLowerCase() === "json";
}

function shouldLog(level: LogLevel): boolean {
  const configured = parseLogLevel(process.env.LOG_LEVEL);
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configured];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeLog(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  const json = isJsonFormat();
  if (json) {
    console.error(
      JSON.stringify({
        timestamp: formatTimestamp(),
        level,
        message,
        ...meta,
      })
    );
  } else {
    const metaText = meta ? ` ${JSON.stringify(meta)}` : "";
    console.error(`[${formatTimestamp()}] [${level.toUpperCase()}] ${message}${metaText}`);
  }
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => writeLog("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => writeLog("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => writeLog("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => writeLog("error", message, meta),
};
