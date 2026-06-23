export function isMissingPathError(error: unknown): boolean {
  return isNodeFsError(error) && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

export function isNodeFsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && typeof error.code === "string";
}
