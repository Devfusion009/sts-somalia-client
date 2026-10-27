import "server-only";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { describeDevice, describeLocation } from "@/lib/auth/device";
import { sendSecurityEmail, type SecurityEmailKind } from "@/lib/notifications/security-email";

/**
 * The account's security activity log (login_events): sign-ins plus password,
 * two-factor and sign-out changes. Best-effort; never blocks the action that
 * triggered it. Lives in lib, not modules/auth, because the sign-in actions
 * (lib/auth/actions.ts) call it — lib never depends on modules (see
 * modules/README.md).
 */

export type SecurityEvent =
  | "sign_in"
  | "password_changed"
  | "mfa_enabled"
  | "mfa_disabled"
  | "recovery_codes_generated"
  | "recovery_code_used"
  | "signed_out_others"
  | "session_revoked";

/** Who is acting, from where: IP, user agent and the edge's approximate location. */
export async function requestContext() {
  const headerList = await headers();
  // x-forwarded-for is a comma-separated chain; the first entry is the client.
  // Behind a proxy that doesn't set it this is null — an unknown IP is better
  // than recording the load balancer's.
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || null;
  const rawCity = headerList.get("x-vercel-ip-city");
  let city: string | null = null;
  try {
    city = rawCity ? decodeURIComponent(rawCity).slice(0, 80) : null;
  } catch {
    city = null;
  }
  const country = headerList.get("x-vercel-ip-country")?.slice(0, 2).toUpperCase() || null;
  const userAgent = headerList.get("user-agent")?.slice(0, 500) ?? null;
  return { ip, city, country, userAgent };
}

const EMAIL_FOR: Partial<Record<SecurityEvent, SecurityEmailKind>> = {
  password_changed: "password_changed",
  mfa_enabled: "mfa_enabled",
  mfa_disabled: "mfa_disabled",
  recovery_code_used: "recovery_code_used",
};

/** Records a security change and, for credential changes, emails the account owner. */
export async function recordSecurityEvent(
  profileId: string,
  event: SecurityEvent,
  opts: { email?: string | null; sessionId?: string | null } = {}
): Promise<void> {
  try {
    const supabase = await createClient();
    const ctx = await requestContext();
    await supabase.from("login_events").insert({
      profile_id: profileId,
      event,
      session_id: opts.sessionId ?? null,
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
      city: ctx.city,
      country: ctx.country,
    });
    const kind = EMAIL_FOR[event];
    if (kind && opts.email) {
      await sendSecurityEmail({
        to: opts.email,
        kind,
        device: describeDevice(ctx.userAgent),
        location: describeLocation(ctx.city, ctx.country),
        ip: ctx.ip,
      });
    }
  } catch {
    // A failed audit write must never stop the change itself.
  }
}

/**
 * Records a sign-in, one row per Supabase session, and emails the owner when
 * it comes from a browser and OS combination the account has not signed in
 * from before (the very first sign-in excepted).
 */
export async function recordLoginEvent(
  profileId: string,
  portal?: string,
  opts: { sessionId?: string | null; email?: string | null } = {}
): Promise<void> {
  try {
    const supabase = await createClient();
    const ctx = await requestContext();

    const { data: previous } = await supabase
      .from("login_events")
      .select("user_agent")
      .eq("profile_id", profileId)
      .eq("event", "sign_in")
      .order("created_at", { ascending: false })
      .limit(50);

    const { error } = await supabase.from("login_events").insert({
      profile_id: profileId,
      event: "sign_in",
      portal: portal ?? null,
      session_id: opts.sessionId ?? null,
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
      city: ctx.city,
      country: ctx.country,
    });
    // 23505: this session's sign-in is already recorded.
    if (error) return;

    const device = describeDevice(ctx.userAgent);
    const known = (previous ?? []).some((row) => describeDevice(row.user_agent) === device);
    if (opts.email && (previous ?? []).length > 0 && !known) {
      await sendSecurityEmail({
        to: opts.email,
        kind: "new_sign_in",
        device,
        location: describeLocation(ctx.city, ctx.country),
        ip: ctx.ip,
      });
    }
  } catch {
    // A failed audit write must never stop someone signing in.
  }
}
