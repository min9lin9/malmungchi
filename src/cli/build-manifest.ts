import { rebuildManifest } from "../bootstrap";
import { env } from "../config/env";
import { logger } from "../util/logger";

async function main() {
  const manifest = await rebuildManifest(env.dataDir, env.corpusName);
  logger.info("Manifest rebuilt");
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
