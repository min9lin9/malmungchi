import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { AuthorPost } from "../author/domain/author-post";
import { loadAuthorPost } from "../author/storage/author-storage";
import type { Env } from "../config/env";
import { InvalidInputError } from "../domain/errors";
import { isNodeFsError } from "../util/fs-errors";
import type { ImportMutationResult, ImportMutations } from "./import-mutations";
import { assertMutableSourceId, resolveContainedPath } from "./source-id";
import type { RefreshSourceFailure, RefreshSourceInput, RefreshSourceResult } from "./source-types";

type AuthorSourceLoadResult =
  | { readonly ok: true; readonly posts: readonly AuthorPost[] }
  | { readonly ok: false; readonly failure: RefreshSourceFailure };

const EMPTY_CHANGES = {
  addedSlugs: [],
  updatedSlugs: [],
  skippedSlugs: [],
  documents: [],
} as const;

export function normalizeRefreshInput(input: string | RefreshSourceInput): RefreshSourceInput {
  return typeof input === "string" ? { sourceId: input } : input;
}

export async function refreshMutableSource(input: {
  readonly env: Env;
  readonly importMutations: ImportMutations;
  readonly sourceId: string;
  readonly dryRun?: boolean;
}): Promise<RefreshSourceResult> {
  if (input.sourceId.startsWith("author:")) {
    const loaded = await loadAuthorSource(input.env.authorsDir, input.sourceId);
    if (!loaded.ok) return failedRefresh(input.sourceId, input.dryRun, loaded.failure);
    return toRefreshResult(
      input.sourceId,
      await input.importMutations.importAuthorPosts(loaded.posts, {
        dryRun: input.dryRun,
      }),
      input.dryRun
    );
  }
  throw new InvalidInputError(`Unsupported source type: ${input.sourceId}`);
}

function toRefreshResult(
  sourceId: string,
  result: ImportMutationResult,
  dryRun?: boolean
): RefreshSourceResult {
  const refreshedDocuments = result.added + result.updated + result.skipped;
  return {
    sourceId,
    refreshedDocuments,
    status: result.added + result.updated > 0 ? "changed" : "unchanged",
    changedDocuments: result.added + result.updated,
    dryRun,
    failures: [],
    ...result,
  };
}

function failedRefresh(
  sourceId: string,
  dryRun: boolean | undefined,
  failure: RefreshSourceFailure
): RefreshSourceResult {
  return {
    sourceId,
    refreshedDocuments: 0,
    status: "failed",
    changedDocuments: 0,
    dryRun,
    failures: [failure],
    added: 0,
    updated: 0,
    skipped: 0,
    addedSlugs: [],
    updatedSlugs: [],
    skippedSlugs: [],
    changes: EMPTY_CHANGES,
  };
}

async function loadAuthorSource(
  authorsDir: string,
  sourceId: string
): Promise<AuthorSourceLoadResult> {
  const parsed = assertMutableSourceId(sourceId);
  if (parsed.kind !== "author") throw new InvalidInputError(`Unsupported source type: ${sourceId}`);
  const postsDir = resolveContainedPath(authorsDir, parsed.entityId, "posts");
  let entries: Dirent[];
  try {
    entries = await fs.readdir(postsDir, { withFileTypes: true });
  } catch (error) {
    return { ok: false, failure: loadFailure(sourceId, readFailureReason(error), postsDir) };
  }
  const posts: AuthorPost[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const postPath = path.join(postsDir, entry.name, "post.md");
    const post = await loadAuthorPost(postPath);
    if (!post) return { ok: false, failure: loadFailure(sourceId, "parse-error", postPath) };
    if (post.authorId === parsed.entityId) posts.push(post);
  }
  return { ok: true, posts };
}

function loadFailure(
  sourceId: string,
  reason: NonNullable<RefreshSourceFailure["reason"]>,
  filePath?: string
): RefreshSourceFailure {
  return {
    stage: "load-source",
    sourceId,
    reason,
    message: filePath
      ? `Stored source file could not be loaded: ${filePath}`
      : `Stored source files are missing for ${sourceId}`,
  };
}

function readFailureReason(error: unknown): NonNullable<RefreshSourceFailure["reason"]> {
  return isNodeFsError(error) && error.code === "ENOENT" ? "missing-storage" : "unreadable";
}
