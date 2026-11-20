type Environment = Record<string, string | undefined>;

export const GOOGLE_RETURN_COOKIE = "__Host-sts-google-return";
export const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

/** NODE_ENV is production on QA too; require the explicit deployment and switch. */
export function customerGoogleOrigin(host: string | null, env: Environment): string | null {
  if (env.DEPLOYMENT_ENV !== "production" || env.CUSTOMER_GOOGLE_LOGIN_ENABLED !== "true") return null;
  try {
    const site = new URL(env.NEXT_PUBLIC_SITE_URL ?? "");
    const auth = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (site.protocol !== "https:" || !["scoutsts.com", "www.scoutsts.com"].includes(site.host)) return null;
    if (site.username || site.password || site.pathname !== "/" || site.search || site.hash) return null;
    if (auth.protocol !== "https:" || !["mdhftphdyqsbxpoblzsd.supabase.co", "auth.scoutsts.com"].includes(auth.host)) return null;
    return host?.toLowerCase() === site.host ? site.origin : null;
  } catch {
    return null;
  }
}

/** Only customer destinations; never accept an external URL or a staff portal. */
export function customerGoogleReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\s\u0000-\u001f]/.test(value)) return "/account";
  try {
    const url = new URL(value, "https://scoutsts.com");
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== "https://scoutsts.com" || /[\\\s\u0000-\u001f]/.test(path)) return "/account";
    const normalized = new URL(path, "https://scoutsts.com");
    if (normalized.origin !== url.origin || path.includes("%")) return "/account";
    if (normalized.pathname !== "/" && !/^\/(account|checkout|flights|hotels|visa|umrah|events|about)(\/|$)/.test(normalized.pathname)) return "/account";
    return `${normalized.pathname}${url.search}${url.hash}`;
  } catch {
    return "/account";
  }
}

export function isGoogleCustomer(
  profile: { role: string; is_platform_admin: boolean } | null,
  metadata: Record<string, unknown>,
  hasManagerSeat: boolean,
): boolean {
  return profile?.role === "customer" && profile.is_platform_admin === false && !hasManagerSeat &&
    !metadata.agent_application_id && !metadata.manager_identity_id;
}
