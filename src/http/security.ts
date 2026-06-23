import { legacyEnvName } from "../config/env-names";

export function getCorsOrigin(): string {
  return process.env.MALMUNGCHI_CORS_ORIGIN ?? process.env[legacyEnvName("CORS_ORIGIN")] ?? "*";
}

export function applySecurityHeaders(
  headers: Record<string, string | number>,
  origin: string
): void {
  headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
  headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
  headers.Vary = "Origin";
  headers["X-Content-Type-Options"] = "nosniff";
  headers["X-Frame-Options"] = "DENY";
  headers["Content-Security-Policy"] = "default-src 'none'";
  headers["Referrer-Policy"] = "no-referrer";
}
