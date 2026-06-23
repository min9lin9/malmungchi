import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { z } from "zod";
import { buildService } from "../src/bootstrap";
import { createHttpApp } from "../src/http/app";

class SmokeStepError extends Error {
  readonly name = "SmokeStepError";

  constructor(
    readonly step: string,
    message: string
  ) {
    super(`${step}: ${message}`);
  }
}

const ImportAuthorResponse = z.object({
  authorId: z.string(),
  importedPosts: z.number(),
  updatedPosts: z.number().default(0),
  skippedPosts: z.number().default(0),
});
const RefreshResponse = z.object({
  dryRun: z.boolean().optional(),
  status: z.string(),
  updated: z.number(),
  failures: z.array(z.unknown()),
});
const SearchResponse = z.object({
  returned: z.number(),
});
const CompactResponse = z.object({
  sourceId: z.string(),
  skippedMalformedEvents: z.number(),
  backupRetained: z.boolean(),
});
const ExportResponse = z.object({
  manifest: z.object({
    documentSetChecksum: z.string(),
    bundleChecksum: z.string(),
  }),
});
const CompareResponse = z.object({
  supported: z.boolean(),
  query: z.string(),
});

type HttpApp = ReturnType<typeof createHttpApp>;

async function main(): Promise<void> {
  const dataDir = await resolveDataDir();
  await ensureMalmungchiDirs(dataDir);

  const service = await buildService(dataDir, "prototype-smoke");
  const app = createHttpApp(service);
  const sourceId = "author:prototype-smoke";

  const imported = await requestJson(app, "POST", "/malmungchi/import-author", ImportAuthorResponse, {
    authorId: "prototype-smoke",
    fileName: "smoke.md",
    fileContent: "# Prototype Smoke\n\noriginal smoke token",
  });
  requireCondition(
    "import-author",
    imported.importedPosts + imported.updatedPosts + imported.skippedPosts >= 1,
    "expected at least one available post"
  );

  const postPath = path.join(dataDir, "authors", "prototype-smoke", "posts", "prototype-smoke", "post.md");
  const originalPost = await fs.readFile(postPath, "utf-8");
  await fs.writeFile(
    postPath,
    originalPost
      .replace(/"content_hash": "[^"]+"/u, '"content_hash": "prototype-smoke-updated"')
      .replace("original smoke token", "updated smoke token"),
    "utf-8"
  );

  const dryRun = await requestJson(
    app,
    "POST",
    `/malmungchi/sources/${sourceId}/refresh?dryRun=true`,
    RefreshResponse
  );
  requireCondition("dry-run", dryRun.dryRun === true, "expected dryRun true");
  requireCondition("dry-run", dryRun.updated === 1, "expected one planned update");
  requireCondition("dry-run", dryRun.failures.length === 0, "expected no dry-run failures");

  const drySearch = await requestJson(app, "GET", "/search?q=updated%20smoke&limit=1", SearchResponse);
  requireCondition("dry-run-search", drySearch.returned === 0, "dry-run mutated search index");

  const refresh = await requestJson(app, "POST", `/malmungchi/sources/${sourceId}/refresh`, RefreshResponse);
  requireCondition("refresh", refresh.status === "changed", "expected changed refresh");

  const liveSearch = await requestJson(app, "GET", "/search?q=updated%20smoke&limit=1", SearchResponse);
  requireCondition("refresh-search", liveSearch.returned > 0, "expected refreshed content in search");

  await fs.appendFile(path.join(dataDir, ".cache", "source-memory.jsonl"), "{bad-json\n");
  const compact = await requestJson(
    app,
    "POST",
    `/malmungchi/sources/${sourceId}/memory/compact`,
    CompactResponse
  );
  requireCondition("compact", compact.skippedMalformedEvents === 1, "expected one malformed event");
  requireCondition("compact", compact.backupRetained, "expected retained backup");

  const exported = await requestJson(
    app,
    "GET",
    `/malmungchi/sources/${sourceId}/export?format=json&includeHistory=true`,
    ExportResponse
  );
  const compare = await requestJson(app, "GET", "/search/compare?q=updated%20smoke&limit=3", CompareResponse);

  console.log("prototype smoke ok");
  console.log(
    JSON.stringify(
      {
        sourceId: compact.sourceId,
        documentSetChecksum: exported.manifest.documentSetChecksum,
        bundleChecksum: exported.manifest.bundleChecksum,
        compareSupported: compare.supported,
      },
      null,
      2
    )
  );
}

async function requestJson<Schema extends z.ZodTypeAny>(
  app: HttpApp,
  method: "GET" | "POST",
  route: string,
  schema: Schema,
  body?: unknown
): Promise<z.infer<Schema>> {
  const response = await app.handle(
    new Request(`http://localhost${route}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );
  if (!response.ok) {
    throw new SmokeStepError(route, `HTTP ${response.status}: ${await response.text()}`);
  }
  return schema.parse(await response.json());
}

async function resolveDataDir(): Promise<string> {
  const parsed = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "data-dir": { type: "string" },
    },
    strict: true,
  });
  const dataDir = parsed.values["data-dir"];
  if (typeof dataDir === "string") return dataDir;
  return fs.mkdtemp(path.join(os.tmpdir(), "malmungchi-prototype-smoke-"));
}

async function ensureMalmungchiDirs(dataDir: string): Promise<void> {
  await fs.mkdir(path.join(dataDir, "documents"), { recursive: true });
  await fs.mkdir(path.join(dataDir, "categories"), { recursive: true });
  await fs.mkdir(path.join(dataDir, "imports"), { recursive: true });
}

function requireCondition(step: string, condition: boolean, message: string): void {
  if (!condition) throw new SmokeStepError(step, message);
}

if (import.meta.main) {
  main().catch((error) => {
    if (error instanceof Error) {
      console.error(error.message);
      process.exit(1);
    }
    console.error(String(error));
    process.exit(1);
  });
}
