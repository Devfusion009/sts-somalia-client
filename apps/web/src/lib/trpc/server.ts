import "server-only";
import { createTRPCClient, httpBatchLink, TRPCClientError } from "@trpc/client";
import { createClient } from "@/lib/supabase/server";
import type { AppRouter } from "./shared";
import { apiUrl } from "./shared";

/**
 * Server-side (vanilla, non-React-Query) tRPC client for Server Components —
 * the reusable version of what api-health/page.tsx proved by hand in phase 0.
 * Forwards the current request's Supabase session token as a bearer header,
 * same as the client-side provider, just sourced from the cookie-bound SSR
 * client instead of the browser client.
 */
export async function getServerTrpc() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${apiUrl()}/trpc`,
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      }),
    ],
  });
}

export { TRPCClientError };
