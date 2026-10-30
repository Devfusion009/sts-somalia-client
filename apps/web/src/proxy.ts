import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  portalSubdomainFor,
  pathPrefixFor,
  rootOrigin,
  portalsAreIsolated,
  type PortalSubdomain,
} from "@/lib/subdomain";
import { readEdgeSession } from "@/lib/auth/edge-session";
import { refreshSession, withSession } from "@/lib/supabase/proxy";

const ALL_PORTALS: readonly PortalSubdomain[] = ["admin", "agent", "manager", "affiliate", "partner", "venue"];
const ALL_PORTAL_PATHS = ALL_PORTALS.map(pathPrefixFor);

/** Public-site sections a visitor must be signed in to open. /umrah itself stays public. */
const SIGNED_IN_PATHS = ["/flights", "/hotels", "/visa", "/checkout", "/umrah/"];
const requiresSignIn = (pathname: string) =>
  SIGNED_IN_PATHS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));

/**
 * Phase 2 portal-subdomain routing (docs/B2B-PORTAL-SEPARATION-BUILD-PROMPT.md).
 * A no-op — every request just passes through — until NEXT_PUBLIC_APP_HOST
 * is set (see lib/subdomain.ts). That's the safe default: Phase 1's
 * path-based /admin, /agent, /manager, /affiliate, /partner, /venue keep
 * working exactly as before on every environment that hasn't configured
 * subdomains yet.
 *
 * Once configured, for each portal:
 *   - <portal>.<APP_HOST>/*  is rewritten to /<portal>/*  internally
 *   - the root host can no longer reach /<portal> directly at all (404, not
 *     a redirect — this is the actual security boundary the rest of the
 *     portal-separation work assumes, not just obscurity)
 *
 * NOTE (this Next.js version, 16.2.12): the file-convention here is
 * `proxy.ts`/`export function proxy`, NOT `middleware.ts`/`middleware` —
 * that name is deprecated in this version. See
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 *
 * NOTE: next.config.ts's `turbopack.root` MUST stay the bare `__dirname`
 * identifier — `path.join(__dirname)` is byte-identical as a string but
 * silently breaks this file's execution entirely in this Next.js version
 * (compiles fine, "ƒ Proxy (Middleware)" shows in the build output, just
 * never actually runs). See the comment on that line.
 */
export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const subdomain = portalSubdomainFor(host);
  const { pathname } = request.nextUrl;
  // Before the edge gate, so an expired-but-refreshable token passes it.
  const sessionCookies = await refreshSession(request);
  const forward = { request: { headers: request.headers } };

  if (subdomain) {
    // ---- Edge gate -------------------------------------------------------
    // Turn the wrong caller away here, before the portal's React tree renders.
    // Everything except the portal's own sign-in flow requires a session, and
    // the admin origin additionally requires the is_platform_admin claim.
    //
    // Defence in depth, not the boundary: requirePlatformAdmin() in the layout
    // re-reads the live column (a token minted before a demotion still carries
    // the old claim), and RLS gates the data regardless. What this buys is that
    // an unauthorised request never reaches application code at all.
    const isAuthRoute =
      pathname === "/login" ||
      pathname.startsWith("/login/") ||
      pathname === "/reset-password" ||
      pathname.startsWith("/auth/");

    if (!isAuthRoute) {
      const result = await readEdgeSession(request);

      // "unverifiable" means the edge couldn't reach the signing keys, not that
      // the caller is unauthorised. Fall through and let requirePlatformAdmin()
      // decide — it re-reads the live column anyway, so nothing is weakened; the
      // alternative is bouncing real admins to login on every cold start.
      if (result.kind === "none") {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        // Preserve where they were headed so the portal login can return them.
        loginUrl.search = pathname === "/" ? "" : `?redirect_to=${encodeURIComponent(pathname)}`;
        return withSession(NextResponse.redirect(loginUrl), sessionCookies);
      }

      // claimMissing covers tokens issued before the custom access token hook
      // existed: let those through and let the layout guard decide, rather than
      // locking out an admin holding a still-valid older session.
      if (
        result.kind === "session" &&
        subdomain === "admin" &&
        !result.session.isPlatformAdmin &&
        !result.session.claimMissing
      ) {
        return withSession(NextResponse.redirect(rootOrigin() || new URL("/", request.url)), sessionCookies);
      }
    }
    // ---------------------------------------------------------------------

    const prefix = pathPrefixFor(subdomain);
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      // Someone hit admin.<host>/admin/... directly (e.g. an old bookmark,
      // or a link that wasn't updated) — avoid double-prefixing.
      return withSession(NextResponse.next(forward), sessionCookies);
    }
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${pathname === "/" ? "" : pathname}`;
    return withSession(NextResponse.rewrite(url, forward), sessionCookies);
  }

  // Root host: block direct access to every portal's path tree entirely.
  // rootOrigin() is only non-empty once subdomains are actually
  // configured, so this block is unreachable (and Phase 1 access to
  // /admin, /agent, /manager, /affiliate, /partner, /venue on the single
  // host stays intact) until then.
  if (portalsAreIsolated() && ALL_PORTAL_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return new NextResponse("Not Found", { status: 404, headers: { "content-type": "text/plain" } });
  }

  if (requiresSignIn(pathname)) {
    const result = await readEdgeSession(request);
    // "unverifiable" falls through: the page-level guard decides, as for the portals.
    if (result.kind === "none") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = `?redirect_to=${encodeURIComponent(pathname + request.nextUrl.search)}`;
      return withSession(NextResponse.redirect(loginUrl), sessionCookies);
    }
  }

  return withSession(NextResponse.next(forward), sessionCookies);
}

export const config = {
  // Excludes the whole /_next/* tree, not just /_next/static and
  // /_next/image — this must also exclude /_next/webpack-hmr specifically.
  // Rewriting that path (as the narrower exclusion used to let happen)
  // breaks the dev-mode HMR websocket entirely, which in turn left client
  // hydration incomplete on every subdomain-rewritten page: React never
  // finished attaching event listeners, so every onClick handler silently
  // did nothing — no console error, no network request, nothing. Confirmed
  // by A/B testing the identical page with subdomains on vs. off.
  matcher: ["/((?!_next/|favicon.ico|api/).*)"],
};
