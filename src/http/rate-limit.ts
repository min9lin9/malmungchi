import { legacyEnvName } from "../config/env-names";

const WINDOW_MS = 60_000;

function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "anonymous";
}

function getLimit(limitRpm?: number): number {
  if (limitRpm !== undefined) return Math.max(1, Math.floor(limitRpm));

  const raw = process.env.MALMUNCHI_RATE_LIMIT_RPM ?? process.env[legacyEnvName("RATE_LIMIT_RPM")];
  if (!raw) return 60;
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) || value < 1 ? 60 : value;
}

export type RateLimitCheck = (
  request: Request,
  set: { status?: number; headers: Record<string, string | number> }
) => { error: string; retryAfter: number } | undefined;

export function createRateLimiter(options: { limitRpm?: number } = {}): RateLimitCheck {
  const store = new Map<string, number[]>();

  return (request, set) => {
    const limit = getLimit(options.limitRpm);
    const key = getClientId(request);
    const now = Date.now();

    const history = store.get(key) ?? [];
    const windowStart = now - WINDOW_MS;
    const recent = history.filter((ts) => ts > windowStart);

    if (recent.length >= limit) {
      const oldest = recent[0] ?? now;
      const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
      set.status = 429;
      set.headers["Retry-After"] = String(retryAfter);
      return {
        error: "Too Many Requests",
        retryAfter,
      };
    }

    recent.push(now);
    store.set(key, recent);
  };
}
