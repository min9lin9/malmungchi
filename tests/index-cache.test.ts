import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildManifest } from "../src/ingest/build-manifest";
import { loadDocuments } from "../src/ingest/load-documents";
import {
  computeEngineConfigHash,
  computeMalmungchiHash,
  getCachePaths,
  importIndexCache,
  loadIndexCache,
  saveIndexCache,
} from "../src/search/index-cache";
import { buildFixtureEngine } from "./helpers/build-fixture-engine";

const DATA_DIR = path.join(import.meta.dir, "..", "data");

describe("index cache", () => {
  it("computeMalmungchiHash is stable across manifest rebuilds with same content", async () => {
    const malmungchi = await loadDocuments(DATA_DIR);
    const manifest1 = await buildManifest(malmungchi, {
      name: "test-malmungchi",
      dataDir: DATA_DIR,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const manifest2 = await buildManifest(malmungchi, {
      name: "test-malmungchi",
      dataDir: DATA_DIR,
    });

    expect(manifest1.generatedAt).not.toBe(manifest2.generatedAt);
    expect(computeMalmungchiHash(manifest1)).toBe(computeMalmungchiHash(manifest2));
  });

  it("returns null for invalid cache JSON", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cache-test-"));
    const paths = getCachePaths(tmpDir);
    await fs.mkdir(paths.cacheDir, { recursive: true });
    await fs.writeFile(paths.cacheFile, "not json", "utf-8");
    const cached = await loadIndexCache(paths, "hash1", "hash2");
    expect(cached).toBeNull();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns null when schema version or hash mismatches", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cache-test-"));
    const paths = getCachePaths(tmpDir);
    await fs.mkdir(paths.cacheDir, { recursive: true });
    await fs.writeFile(
      paths.cacheFile,
      JSON.stringify({
        schemaVersion: 999,
        libraryHash: "hash1",
        engineConfigHash: "hash2",
        indices: {},
      }),
      "utf-8"
    );
    const cached = await loadIndexCache(paths, "hash1", "hash2");
    expect(cached).toBeNull();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("save/load/import roundtrip works", async () => {
    const engine = (await buildFixtureEngine()) as unknown as {
      index: {
        export: (cb: (key: string, value: unknown) => void) => Promise<void> | void;
        import: (key: string, value: unknown) => Promise<void> | void;
      };
    };
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cache-test-"));
    const paths = getCachePaths(tmpDir);
    const libraryHash = "roundtrip-malmungchi";
    const engineConfigHash = computeEngineConfigHash({
      tokenize: "forward",
      weights: { title: 3, guest: 2, keywords: 2, transcript: 1 },
    });

    await saveIndexCache(paths, engine.index as never, libraryHash, engineConfigHash);
    const cached = await loadIndexCache(paths, libraryHash, engineConfigHash);
    expect(cached).not.toBeNull();
    if (cached) {
      await importIndexCache(engine.index as never, cached);
    }
    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
