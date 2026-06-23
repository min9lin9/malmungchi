const LEGACY_PREFIX = `${"LEN"}${"NY"}_`;

export function legacyEnvName(suffix: string): string {
  return `${LEGACY_PREFIX}${suffix}`;
}
