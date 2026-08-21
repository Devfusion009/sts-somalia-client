import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Records a sign-in for the login-history list. Best-effort; never blocks
 * login. Lives in lib, not modules/auth, because the sign-in action itself
 * (lib/auth/actions.ts) calls it — lib never depends on modules (see
 * modules/README.md) — while modules/auth/security-actions.ts (the
 * user-facing security-settings actions: change password, sign out
 * everywhere, delete account) is free to depend on lib.
 */
export async function recordLoginEvent(profileId: string, portal?: string): Promise<void> {
  try {
    const supabase = await createClient();
    const headerList = await headers();

    // x-forwarded-for is a comma-separated chain; the first entry is the
    // client. Behind a proxy that doesn't set it, this is simply null — an
    // unknown IP is better than recording the load balancer's.
    const forwarded = headerList.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;

    await supabase.from("login_events").insert({
      profile_id: profileId,
      portal: portal ?? null,
      ip_address: ip,
      user_agent: headerList.get("user-agent")?.slice(0, 500) ?? null,
    });
  } catch {
    // A failed audit write must never stop someone signing in.
  }
}
