import { MalmunchiError } from "../domain/errors";

export function handleToolError(error: unknown): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  if (error instanceof MalmunchiError) {
    return {
      content: [{ type: "text", text: error.message }],
      isError: true,
    };
  }

  console.error("[mcp tool error]", error);
  const message = error instanceof Error ? error.message : "An unexpected error occurred";
  return {
    content: [{ type: "text", text: `[INTERNAL_ERROR] ${message}` }],
    isError: true,
  };
}
