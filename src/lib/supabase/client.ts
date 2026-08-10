import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.types";
import { cookieDomain } from "@/lib/subdomain";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    // Must match the server client's scoping — client-side auth calls (MFA
    // enroll/verify, sign-out) write the session cookie directly, and a
    // mismatch would leave a second cookie at the other scope under the same
    // name. See lib/supabase/server.ts.
    { cookieOptions: { domain: cookieDomain() || undefined } }
  );
}
