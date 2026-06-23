import fs from "node:fs/promises";
import path from "node:path";
import { importAuthorFile, importAuthorText } from "../author/storage/author-storage";
import type { Env } from "../config/env";
import { InvalidInputError } from "../domain/errors";
import { SourceMemory } from "../source/source-memory";
import type { ImportMutations } from "./import-mutations";

const AUTHOR_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMPORT_EXTENSIONS = new Set([".md", ".jsonl"]);

export interface ImportAuthorInput {
  filePath?: string;
  fileContent?: string;
  fileName?: string;
  authorId: string;
  splitBy?: string;
  tocKey?: string;
}

export interface ImportAuthorResult {
  authorId: string;
  importedPosts: number;
  updatedPosts: number;
  skippedPosts: number;
  savedTo?: string;
}

export class AuthorOperations {
  private readonly memory?: SourceMemory;

  constructor(
    private readonly importMutations: ImportMutations,
    private readonly env?: Env
  ) {
    this.memory = env ? SourceMemory.fromDataDir(env.dataDir) : undefined;
  }

  async importAuthor(input: ImportAuthorInput): Promise<ImportAuthorResult> {
    if (!this.env) {
      throw new InvalidInputError("Author import requires environment configuration");
    }
    if (!input.filePath && !input.fileContent) {
      throw new InvalidInputError("Author import requires filePath or fileContent");
    }
    if (!AUTHOR_ID_PATTERN.test(input.authorId)) {
      throw new InvalidInputError("Author ID must be lowercase kebab-case");
    }

    const result = input.filePath
      ? await importAuthorFile({
          filePath: await this.resolveImportPath(input.filePath),
          authorId: input.authorId,
          authorsDir: this.env.authorsDir,
          splitBy: input.splitBy,
          tocKey: input.tocKey,
        })
      : await importAuthorText({
          content: input.fileContent ?? "",
          fileName: input.fileName ?? "inline.md",
          authorId: input.authorId,
          authorsDir: this.env.authorsDir,
          splitBy: input.splitBy,
          tocKey: input.tocKey,
        });

    const importResult = await this.importMutations.importAuthorPosts(result.posts);
    await this.memory?.record({
      sourceId: `author:${input.authorId}`,
      action: "import",
      documentCount: result.posts.length,
    });
    return {
      authorId: input.authorId,
      importedPosts: importResult.added,
      updatedPosts: importResult.updated,
      skippedPosts: importResult.skipped,
      savedTo: this.env.authorsDir,
    };
  }

  private async resolveImportPath(filePath: string): Promise<string> {
    if (!this.env) throw new InvalidInputError("Author import requires environment configuration");

    const extension = path.extname(filePath).toLowerCase();
    if (!ALLOWED_IMPORT_EXTENSIONS.has(extension)) {
      throw new InvalidInputError("Author import filePath must point to a .md or .jsonl file");
    }

    await fs.mkdir(this.env.authorImportDir, { recursive: true });
    const [root, resolved] = await Promise.all([
      fs.realpath(this.env.authorImportDir),
      fs.realpath(filePath).catch(() => {
        throw new InvalidInputError(`Author import file not found: ${filePath}`);
      }),
    ]);
    const relative = path.relative(root, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new InvalidInputError(
        `Author import filePath must be inside ${this.env.authorImportDir}`
      );
    }

    const stat = await fs.stat(resolved);
    if (!stat.isFile()) throw new InvalidInputError("Author import filePath must point to a file");
    if (stat.size > MAX_IMPORT_FILE_BYTES) {
      throw new InvalidInputError("Author import file exceeds the 20MB limit");
    }
    return resolved;
  }
}
