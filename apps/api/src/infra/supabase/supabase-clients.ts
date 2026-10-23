import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../../config/env";

/**
 * Framework-agnostic Supabase client builders — the direct backend
 * equivalent of apps/web's lib/supabase/server.ts (cookie-bound) and
 * lib/supabase/admin.ts (service-role). Kept independent of Nest's DI so
 * the same functions back both REST controllers (via the request-scoped
 * services below) and tRPC procedures (via trpc/context.ts), which don't
 * share Nest's per-request injection scope.
 */

function requireEnv(name: "SUPABASE_URL" | "SUPABASE_ANON_KEY" | "SUPABASE_SECRET_KEY"): string {
  return env()[name];
}

/**
 * RLS-enforced client, authenticated as the calling user via their bearer
 * access token — same enforcement as apps/web's cookie-bound createClient(),
 * just carried over a header instead of a cookie.
 */
export function createRlsClient(accessToken: string): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

/**
 * Anon-key client, no user session — for genuinely public reads (flight
 * search, airport lookups) where the original apps/web code used the
 * cookie-bound client without requiring a logged-in visitor. RLS still
 * applies (via Postgres's `anon` role policies), it's just not scoped to
 * any particular user. Added phase 4c: everything migrated before this
 * point required a bearer token, so there was no anonymous-access path yet.
 */
export function createAnonClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Service-role client. BYPASSES ROW LEVEL SECURITY ENTIRELY — mirrors
 * apps/web's createAdminClient() restriction. Only inject
 * AdminSupabaseService into modules that genuinely need it.
 */
export function createAdminClient(): SupabaseClient {
  const url = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SECRET_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Resolves the caller's identity from a bearer token without RLS — used by the auth guard. */
export async function getUserForToken(accessToken: string) {
  const client = createRlsClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}
