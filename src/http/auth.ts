import { legacyEnvName } from "../config/env-names";

const PUBLIC_PATHS = new Set(["/health", "/health/ready"]);

function getApiKey(): string | undefined {
  return process.env.MALMUNGCHI_API_KEY ?? process.env[legacyEnvName("API_KEY")];
}

export function checkApiKey(
  request: Request,
  set: { status?: number; headers: Record<string, string | number> },
  path: string
): { error: string } | undefined {
  const apiKey = getApiKey();
  if (!apiKey) return;
  if (PUBLIC_PATHS.has(path)) return;

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;

  if (token !== apiKey) {
    set.status = 401;
    set.headers["WWW-Authenticate"] = 'Bearer realm="malmungchi"';
    return { error: "Unauthorized" };
  }
}
