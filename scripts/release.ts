import fs from "node:fs/promises";
import { $ } from "bun";

interface PackageJson {
  version: string;
  [key: string]: unknown;
}

function bump(current: string, type: string): string {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid version: ${current}`);
  }

  const [major, minor, patch] = parts;
  switch (type) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Unknown release type: ${type}. Use patch, minor, or major.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const type = args.find((arg) => !arg.startsWith("--")) ?? "patch";
  const dryRun = args.includes("--dry-run");
  const skipChecks = args.includes("--skip-checks");
  const pkgPath = "package.json";
  const pkg = parsePackageJson(await fs.readFile(pkgPath, "utf-8"));
  const current = pkg.version;
  const next = bump(current, type);

  if (dryRun) {
    console.log(`Current version: ${current}`);
    console.log(`Next version: ${next}`);
    return;
  }

  const status = await $`git status --porcelain`.quiet();
  if (status.stdout.toString().trim()) {
    throw new Error("Release requires a clean git tree.");
  }

  if (!skipChecks) {
    await $`bun run release:check`;
  }

  pkg.version = next;
  await fs.writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");

  const date = new Date().toISOString().split("T")[0];
  const changelogPath = "CHANGELOG.md";
  const changelog = await readOptionalText(changelogPath, "# Changelog\n\n");
  const entry = `## ${next} - ${date}\n\n- Release ${next}\n`;
  const updated = changelog.includes("## [Unreleased]")
    ? changelog.replace("## [Unreleased]\n\n", `## [Unreleased]\n\n${entry}`)
    : `${entry}\n${changelog}`;
  await fs.writeFile(changelogPath, updated, "utf-8");

  await $`git add package.json CHANGELOG.md`;
  await $`git commit -m ${`chore(release): ${next}`}`;
  await $`git tag -a ${`v${next}`} -m ${`Release v${next}`}`;

  console.log(`Released v${next}`);
  console.log(`Run "git push origin main --tags" to publish.`);
}

function parsePackageJson(content: string): PackageJson {
  const parsed: unknown = JSON.parse(content);
  if (!isPackageJson(parsed)) {
    throw new Error("package.json must contain a string version field.");
  }
  return parsed;
}

function isPackageJson(value: unknown): value is PackageJson {
  return isRecord(value) && typeof value.version === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readOptionalText(filePath: string, fallback: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return fallback;
    throw error;
  }
}

function isNodeError(value: unknown): value is { readonly code?: unknown } {
  return isRecord(value) && "code" in value;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
