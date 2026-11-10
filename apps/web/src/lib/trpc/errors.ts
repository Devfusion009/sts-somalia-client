import { TRPCClientError } from "@trpc/client";

/** The API's own message for a refused call (already one plain line), or the fallback. */
export function trpcErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof TRPCClientError) || !error.message) return fallback;
  // A refused input arrives as the JSON list of zod issues; show the first one's message.
  if (error.message.startsWith("[")) {
    try {
      const issues = JSON.parse(error.message) as { message?: string }[];
      return issues[0]?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return error.message;
}

