import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

/**
 * Signed-out client: publishable key, no cookies, no session. Reads made
 * with it return exactly what an anonymous visitor may see, whoever asks, so
 * the result is safe to store in the shared Redis cache (lib/redis.ts). A
 * cookie-bound client could hand a signed-in admin's wider view to everyone.
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  );
}
