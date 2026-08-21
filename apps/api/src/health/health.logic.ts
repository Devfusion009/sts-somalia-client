import type { SupabaseClient } from "@supabase/supabase-js";
import type { MeResult } from "@sts/shared-types";

/**
 * Shared by the REST controller and the tRPC router — proves the RLS
 * pipeline end-to-end by doing a real `profiles` table read through an
 * RLS-scoped client, not just decoding the JWT. If RLS were misconfigured
 * (or this were handed an admin/service-role client by mistake) this call
 * site is exactly where that would surface, since it's scoped to "your own
 * row" by policy, not by the query.
 */
export async function getMe(
  client: SupabaseClient,
  userId: string,
  email: string | null
): Promise<MeResult> {
  const { data: profile, error } = await client
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(`RLS-scoped profile read failed: ${error.message}`);
  }

  return {
    userId,
    email,
    isPlatformAdmin: Boolean(profile?.is_platform_admin),
  };
}
