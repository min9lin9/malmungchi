import { buildService } from "../bootstrap";
import { env } from "../config/env";

const QUERIES = [
  "hiring",
  "product",
  "product market fit",
  '"product market fit"',
  "product OR market",
  "leadership",
  "Brian Chesky",
  "growth strategy",
  "xyznonsense12345",
];

async function main() {
  console.error(`Benchmarking malmunchi in ${env.dataDir}...`);
  const service = await buildService(env.dataDir, env.instanceName);

  console.log("query,elapsed_ms,total,returned");
  for (const query of QUERIES) {
    const start = performance.now();
    const result = await service.searchDocuments({ query, limit: 10 });
    const elapsed = performance.now() - start;
    console.log(`"${query}",${elapsed.toFixed(2)},${result.total},${result.returned}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
