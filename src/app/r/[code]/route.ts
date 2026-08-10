import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AFFILIATE_COOKIE } from "@/modules/affiliates/attribution";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30-day attribution window

/**
 * Affiliate referral entry point: /r/<link-code> logs the click, drops the
 * attribution cookie, and forwards to the link's target page. Clicks are
 * written with the service role (affiliate_clicks has no client insert
 * policy by design) and IPs are hashed before storage.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("affiliate_links")
    .select("id, affiliate_id, target_path, clicks_count, affiliates!inner(status)")
    .eq("code", code)
    .maybeSingle();

  // Unknown/inactive links still land somewhere sensible — just untracked.
  if (!link || link.affiliates.status !== "active") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const visitorId =
    request.cookies.get(AFFILIATE_COOKIE)?.value.split(":")[2] ?? crypto.randomUUID();

  const { data: click } = await supabase
    .from("affiliate_clicks")
    .insert({
      link_id: link.id,
      visitor_id: visitorId,
      ip_hash: ip ? createHash("sha256").update(ip).digest("hex") : null,
      user_agent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
    })
    .select("id")
    .single();

  await supabase
    .from("affiliate_links")
    .update({ clicks_count: link.clicks_count + 1 })
    .eq("id", link.id);

  const target = link.target_path.startsWith("/") ? link.target_path : "/";
  const response = NextResponse.redirect(new URL(target, request.url));
  // Last-click-wins attribution, read at order creation in orders/helpers.ts.
  response.cookies.set(AFFILIATE_COOKIE, `${link.affiliate_id}:${click?.id ?? ""}:${visitorId}`, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
