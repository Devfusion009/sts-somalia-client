import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY ENTIRELY.
 *
 * Only use this for:
 *   - Payment/webhook handlers reconciling state after a provider callback
 *   - Trusted server-side integrations (flight search cache writes, etc.)
 *   - Admin-only background jobs
 *
 * Never import this module from a Client Component or expose its result
 * to the browser. The `server-only` import above makes any accidental
 * client-bundle import fail at build time.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
