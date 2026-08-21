import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.types";
import { cookieDomain } from "@/lib/subdomain";

/**
 * Server Component / Server Action / Route Handler client. Runs as the
 * calling user (RLS enforced via their JWT) — never use this for
 * privileged/service-role access.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      // Host-only: the session written on admin.<host> is not readable on
      // <host>, which is what keeps the portals from sharing a credential.
      // See lib/subdomain.ts for why, and for the one knob that changes it.
      cookieOptions: { domain: cookieDomain() || undefined },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request/response to
            // write to — safe to ignore as long as proxy.ts refreshes the
            // session on every navigation (see proxy.ts at the repo root).
          }
        },
      },
    }
  );
}
