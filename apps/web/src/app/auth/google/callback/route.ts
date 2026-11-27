import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordLoginEvent } from "@/lib/auth/login-history";
import { sessionIdFromAccessToken } from "@/lib/auth/device";
import { customerGoogleOrigin, customerGoogleReturnPath, GOOGLE_RETURN_COOKIE, isGoogleCustomer } from "@/lib/auth/google-policy";

export async function GET(request: NextRequest) {
  const origin = customerGoogleOrigin(request.headers.get("host"));
  if (!origin) return new NextResponse("Not Found", { status: 404 });
  const store = await cookies();
  const next = customerGoogleReturnPath(store.get(GOOGLE_RETURN_COOKIE)?.value);
  store.set(GOOGLE_RETURN_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  const failure = () => NextResponse.redirect(`${origin}/login?error=google_sign_in_failed`);
  const code = request.nextUrl.searchParams.get("code");
  if (request.nextUrl.searchParams.has("error") || !code) return failure();

  const supabase = await createClient();
  const exchange = await supabase.auth.exchangeCodeForSession(code).catch(() => null);
  if (!exchange) return failure();
  const { data, error } = exchange;
  if (error || !data.user || !data.session) return failure();
  const reject = async () => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => null);
    // Clear local credentials even when the Auth service cannot revoke them.
    for (const { name } of store.getAll()) {
      if (/^sb-.+-auth-token(?:\.\d+)?$/.test(name)) {
        store.set(name, "", { secure: true, path: "/", maxAge: 0 });
      }
    }
    return failure();
  };
  try {
    const user = data.user;
    const [profile, ...businessIdentities] = await Promise.all([
      supabase.from("profiles").select("role, is_platform_admin").eq("id", user.id).single(),
      supabase.from("hotel_managers").select("hotel_id").eq("profile_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("venue_managers").select("venue_id").eq("profile_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("agency_members").select("agency_id").eq("profile_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("hotel_partner_members").select("partner_id").eq("profile_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("venue_partner_members").select("partner_id").eq("profile_id", user.id).eq("status", "active").limit(1).maybeSingle(),
      supabase.from("affiliates").select("id").eq("profile_id", user.id).limit(1).maybeSingle(),
    ]);
    if (profile.error || businessIdentities.some(identity => identity.error) || !user.email_confirmed_at ||
      !user.identities?.some(identity => identity.provider === "google") ||
      !isGoogleCustomer(profile.data, user.app_metadata, businessIdentities.some(identity => Boolean(identity.data)))) return reject();

    const { data: aal, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (mfaError || !aal || !aal.currentLevel) return reject();
    await recordLoginEvent(user.id, "customer", {
      email: user.email, sessionId: sessionIdFromAccessToken(data.session.access_token),
    });
    const destination = aal.currentLevel === "aal1" && aal.nextLevel === "aal2"
      ? `/login/verify-2fa?redirect_to=${encodeURIComponent(next)}` : next;
    return NextResponse.redirect(`${origin}${destination}`);
  } catch {
    return reject();
  }
}
