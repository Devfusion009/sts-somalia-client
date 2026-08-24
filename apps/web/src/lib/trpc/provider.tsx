"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import { trpc } from "./react";
import { apiUrl } from "./shared";

/**
 * Client-side tRPC + React Query setup — the piece phase 0 never needed
 * (its one proof endpoint was SSR-only). Every request attaches the
 * current session's access token as a bearer header, read fresh per
 * request from the browser Supabase client rather than captured once, so
 * a token refresh mid-session is picked up automatically.
 */
export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${apiUrl()}/trpc`,
          async headers() {
            const supabase = createBrowserSupabaseClient();
            const {
              data: { session },
            } = await supabase.auth.getSession();
            return session ? { Authorization: `Bearer ${session.access_token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
