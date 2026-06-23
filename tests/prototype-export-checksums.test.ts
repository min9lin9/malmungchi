import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import { buildService } from "../src/bootstrap";
import { createHttpApp } from "../src/http/app";
import { buildExportDocuments, buildExportManifest } from "../src/service/source-export-checksums";
import { importPrototypeAuthor, makePrototypeDataDir } from "./prototype-source-test-helpers";

describe("prototype export checksum polish", () => {
  it("exports deterministic checksums and provenance", async () => {
    const dataDir = await makePrototypeDataDir("prototype-export-");
    try {
      const app = createHttpApp(await buildService(dataDir, "test-malmungchi"));
      await importPrototypeAuthor(app, "export-author");

      const first = await app.handle(
        new Request(
          "http://localhost/malmungchi/sources/author:export-author/export?format=json&includeHistory=true"
        )
      );
      expect(first.status).toBe(200);
      const firstBody = (await first.json()) as {
        manifest: {
          readonly documentSetChecksum: string;
          readonly bundleChecksum: string;
          readonly provenanceChecksum: string;
          readonly historyIncluded: boolean;
          readonly exportedAt: string;
        };
        documents: {
          readonly checksum: string;
          readonly checksumAlgorithm: string;
          readonly contentBytes: number;
          readonly provenance: { readonly sourceId: string; readonly sourceType: string };
        }[];
      };
      expect(firstBody.manifest.historyIncluded).toBe(true);
      expect(firstBody.manifest.documentSetChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(firstBody.manifest.bundleChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(firstBody.manifest.provenanceChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(firstBody.documents[0]).toEqual(
        expect.objectContaining({
          checksumAlgorithm: "sha256",
          checksum: expect.stringMatching(/^[a-f0-9]{64}$/),
          contentBytes: expect.any(Number),
          provenance: expect.objectContaining({
            sourceId: "author:export-author",
            sourceType: "author",
          }),
        })
      );

      const second = await app.handle(
        new Request(
          "http://localhost/malmungchi/sources/author:export-author/export?format=json&includeHistory=true"
        )
      );
      const secondBody = (await second.json()) as typeof firstBody;
      expect(secondBody.manifest.exportedAt).not.toBe("");
      expect(secondBody.manifest.documentSetChecksum).toBe(firstBody.manifest.documentSetChecksum);
      expect(secondBody.manifest.bundleChecksum).toBe(firstBody.manifest.bundleChecksum);

      const markdown = await app.handle(
        new Request(
          "http://localhost/malmungchi/sources/author:export-author/export?format=markdown&includeHistory=true"
        )
      );
      const markdownBody = (await markdown.json()) as { markdown: string };
      expect(markdownBody.markdown).toContain("Document set checksum");
      expect(markdownBody.markdown).toContain(firstBody.manifest.bundleChecksum);
    } finally {
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  });

  it("includes document original URLs in provenance checksums", () => {
    const source = {
      id: "author:export-author",
      type: "author" as const,
      label: "author:export-author",
      documentCount: 1,
      interactionCount: 0,
    };
    const firstDocuments = buildExportDocuments({
      source,
      documents: [
        {
          slug: "author:export-author:essay",
          title: "Essay",
          content: "same content",
          originalUrl: "https://example.com/one",
        },
      ],
    });
    const secondDocuments = buildExportDocuments({
      source,
      documents: [
        {
          slug: "author:export-author:essay",
          title: "Essay",
          content: "same content",
          originalUrl: "https://example.com/two",
        },
      ],
    });

    const baseManifest = {
      sourceId: source.id,
      sourceType: source.type,
      exportedAt: new Date(0).toISOString(),
    };
    const first = buildExportManifest({ ...baseManifest, documents: firstDocuments });
    const second = buildExportManifest({ ...baseManifest, documents: secondDocuments });

    expect(first.documentSetChecksum).toBe(second.documentSetChecksum);
    expect(first.provenanceChecksum).not.toBe(second.provenanceChecksum);
    expect(first.bundleChecksum).not.toBe(second.bundleChecksum);
  });
});
