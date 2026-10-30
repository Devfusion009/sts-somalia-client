import "server-only";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createClient } from "@/lib/supabase/server";
import type { AppRouter } from "./shared";
import { apiUrl } from "./shared";

/** Server-side calls use the internal network address when set, skipping DNS, TLS and the public proxy. */
function serverApiUrl(): string {
  return process.env.API_INTERNAL_URL ?? apiUrl();
}

/**
 * Server-side (vanilla, non-React-Query) tRPC client for Server Components —
 * the reusable version of what api-health/page.tsx proved by hand in phase 0.
 * Forwards the current request's Supabase session token as a bearer header,
 * same as the client-side provider, just sourced from the cookie-bound SSR
 * client instead of the browser client.
 */
export async function getServerTrpc(options: { timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 3000;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${serverApiUrl()}/trpc`,
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
        // A slow or unreachable api must not hold a page render hostage:
        // callers already treat a failed call as "no data".
        fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }),
      }),
    ],
  });
}

/** For Server Actions: writes can run several statements, so they get a longer budget than page reads. */
export function getServerTrpcForActions() {
  return getServerTrpc({ timeoutMs: 20000 });
}

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

/**
 * Multipart POST to an apps/api REST route (file uploads — tRPC doesn't carry
 * binary) with the caller's session forwarded. Returns the API's message on refusal.
 */
export async function apiUpload(path: string, body: FormData): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  try {
    const res = await fetch(`${serverApiUrl()}${path}`, {
      method: "POST",
      body,
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      signal: AbortSignal.timeout(60000),
    });
    if (res.ok) return { error: null };
    const json = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(json?.message) ? json?.message[0] : json?.message;
    return { error: message || "The upload failed." };
  } catch {
    return { error: "The upload failed." };
  }
}

export { TRPCClientError };
