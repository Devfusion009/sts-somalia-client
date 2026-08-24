/**
 * Phase 2 portal-subdomain config (docs/B2B-PORTAL-SEPARATION-BUILD-PROMPT.md).
 * Built and verified end-to-end 08 Aug 2026 — routing/blocking, mandatory
 * admin 2FA, and cross-subdomain session persistence all confirmed working
 * against a real multi-label local domain (see .env.example for the two
 * local-dev setup options and a real caveat found with plain *.localhost).
 *
 * Everything here is a no-op — every helper returns "" / relative paths —
 * until NEXT_PUBLIC_APP_HOST is set. That keeps Phase 1 (path-based
 * /admin, /agent, /manager, /affiliate, /partner, /venue) fully working as
 * the default, and turns subdomain enforcement on only once the client's
 * DNS is actually live.
 *
 * Client-safe: NEXT_PUBLIC_* so both proxy.ts (server) and components that
 * render cross-origin links (PortalShell, PortalLoginShell, portalForProfile)
 * can read it without threading it through props.
 */

export const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST || null;

/**
 * Explicit per-portal hostnames, for when the portals live on origins that are
 * NOT `admin.<APP_HOST>` / `agent.<APP_HOST>`.
 *
 * WHY THIS EXISTS
 * `vercel.app` is on the Public Suffix List, so Vercel only ever issues
 * single-label names — `admin.myproject.vercel.app` cannot be allocated. The
 * only way to get separate ORIGINS without buying a domain is a separate Vercel
 * project per portal, which yields unrelated names like
 * `sts-somalia-admin.vercel.app`. The `admin.<host>` pattern can't describe
 * that, so each portal host is named outright instead.
 *
 * Separate origins are the point: host-only session cookies (see cookieDomain)
 * only isolate the portals when they actually sit on different origins. Under
 * path-based mode everything shares one origin and one cookie, and the
 * isolation is nominal.
 *
 * Set the SAME values on every deployment — each one needs to recognise
 * every configured host to route and to link across them correctly.
 */
const ADMIN_HOST = process.env.NEXT_PUBLIC_ADMIN_HOST || null;
const AGENT_HOST = process.env.NEXT_PUBLIC_AGENT_HOST || null;
const MANAGER_HOST = process.env.NEXT_PUBLIC_MANAGER_HOST || null;
const AFFILIATE_HOST = process.env.NEXT_PUBLIC_AFFILIATE_HOST || null;
const PARTNER_HOST = process.env.NEXT_PUBLIC_PARTNER_HOST || null;
const VENUE_HOST = process.env.NEXT_PUBLIC_VENUE_HOST || null;
/** The public/B2C origin, when portals are split across explicit hosts. */
const PUBLIC_HOST = process.env.NEXT_PUBLIC_PUBLIC_HOST || null;

export type PortalSubdomain = "admin" | "agent" | "manager" | "affiliate" | "partner" | "venue";

const EXPLICIT_HOST: Record<PortalSubdomain, string | null> = {
  admin: ADMIN_HOST,
  agent: AGENT_HOST,
  manager: MANAGER_HOST,
  affiliate: AFFILIATE_HOST,
  partner: PARTNER_HOST,
  venue: VENUE_HOST,
};

const bareHost = (h: string) => h.split(":")[0].toLowerCase();

/**
 * True once the portals are on separate origins by ANY mechanism — subdomains
 * of APP_HOST, or explicitly named hosts. Everything that depends on "are these
 * really different origins" keys off this rather than testing APP_HOST alone.
 */
export function portalsAreIsolated(): boolean {
  return Boolean(APP_HOST || Object.values(EXPLICIT_HOST).some(Boolean));
}

const PORTAL_PATH: Record<PortalSubdomain, string> = {
  admin: "/admin",
  agent: "/agent",
  manager: "/manager",
  affiliate: "/affiliate",
  partner: "/partner",
  venue: "/venue",
};

// RFC 2606 / RFC 6761 reserved TLDs used for local/testing setups — any of
// these mean "plain http, no real cert," not just literal "localhost".
// Bit for bit this matters: getting it wrong doesn't degrade gracefully,
// it generates an https:// link to a server that only speaks http, which
// fails outright rather than just looking slightly off.
const LOCAL_TLDS = [".localhost", ".test", ".example", ".invalid", ".local"];

function protocolFor(host: string): "http" | "https" {
  const hostname = host.split(":")[0];
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return "http";
  if (LOCAL_TLDS.some((tld) => hostname.endsWith(tld))) return "http";
  return "https";
}

/** e.g. "https://admin.stssomalia.com" or "http://admin.localhost:3000". "" when portals aren't split out. */
export function portalOrigin(portal: PortalSubdomain): string {
  const explicit = EXPLICIT_HOST[portal];
  if (explicit) return `${protocolFor(explicit)}://${explicit}`;
  if (!APP_HOST) return "";
  return `${protocolFor(APP_HOST)}://${portal}.${APP_HOST}`;
}

/**
 * Full sign-in/switch destination for a portal — origin AND its path
 * prefix, e.g. "http://admin.stssomalia.test:3000/admin" (or just "/admin"
 * when subdomains aren't configured).
 *
 * Naming the path matters even on the portal's own subdomain, where "/"
 * gets rewritten to the same place by proxy.ts. A redirect() issued from a
 * Server Action is resolved by the App Router, which never re-enters the
 * proxy — so a bare-origin target ("https://admin.host") resolves to the
 * app's literal "/" route, i.e. the B2C marketing home, and the admin
 * lands on the storefront right after signing in. Including the prefix
 * makes the destination correct under BOTH resolution paths (the proxy
 * passes "/admin" through untouched on the admin host).
 */
export function portalHref(portal: PortalSubdomain): string {
  const origin = portalOrigin(portal);
  return origin ? `${origin}${PORTAL_PATH[portal]}` : PORTAL_PATH[portal];
}

/**
 * The portal's own sign-in page — the ONE place agents (or admins) enter
 * credentials for that portal.
 *
 * Sessions are host-only (see cookieDomain), so credentials must be submitted
 * ON the portal's origin: a sign-in posted from the public host writes its
 * cookie for the public host, and the portal it then redirects to cannot read
 * it — the user simply lands back on the portal's login page. Anything on the
 * B2C site that offers a way into a portal must therefore LINK here rather
 * than collect the credentials itself.
 *
 * On the portal origin the proxy rewrites "/login" to "<prefix>/login", so the
 * bare origin + "/login" is correct; without subdomains the route is literally
 * "/agent/login".
 */
export function portalLoginHref(portal: PortalSubdomain): string {
  const origin = portalOrigin(portal);
  return origin ? `${origin}/login` : `${PORTAL_PATH[portal]}/login`;
}

/** e.g. "https://stssomalia.com" or "http://localhost:3000". "" when subdomains aren't configured. */
export function rootOrigin(): string {
  if (PUBLIC_HOST) return `${protocolFor(PUBLIC_HOST)}://${PUBLIC_HOST}`;
  if (!APP_HOST) return "";
  return `${protocolFor(APP_HOST)}://${APP_HOST}`;
}

/**
 * Domain to scope the session cookie to. Empty string means host-only.
 *
 * Deliberately host-only, which is what isolates the portals from each other.
 *
 * This previously returned the registrable domain ("stssomalia.test") so one
 * sign-in carried across root, admin.* and agent.*. Convenient, but it meant an
 * ADMIN's session cookie was attached to every request to the public marketing
 * site — so any XSS there (a lead form, a review widget, a third-party script)
 * could lift a session that opens the admin console. The portals were separate
 * origins with a shared credential, which is the weaker half of both models.
 *
 * Host-only cookies mean admin.<host> and <host> cannot see each other's
 * sessions at all. The cost is a separate sign-in per portal, which is the
 * intended behaviour for two applications that merely share a backend.
 *
 * Returns "" unconditionally rather than reading APP_HOST — the isolation is
 * the point, so there is no host for which sharing is wanted. Kept as a
 * function because both Supabase clients call it, and because narrowing it
 * back to a single trusted domain (say, admin.* and agent.* sharing a staff
 * session while the public site stays separate) is a change here alone.
 *
 * MIGRATION NOTE: a browser that signed in while this returned the registrable
 * domain still holds a `Domain=stssomalia.test` cookie under the same name, and
 * will send BOTH it and the new host-only one — the stale, wider cookie can win.
 * There are no such browsers in production (portal subdomains have never been
 * deployed; see the deployment gap on the missing custom domain), so no
 * migration is shipped. Local dev sessions predating this need their cookies
 * cleared once. If subdomains ever go live and this is revisited, @supabase/ssr
 * exports clearAuthCookiesAtScopes() for exactly this.
 */
export function cookieDomain(): string {
  return "";
}

/**
 * Given an incoming request's `host` header, returns which portal
 * subdomain it is (a PortalSubdomain), or null if it's the root host (or
 * subdomains aren't configured at all). Used by proxy.ts.
 */
const ALL_PORTALS: readonly PortalSubdomain[] = ["admin", "agent", "manager", "affiliate", "partner", "venue"];

export function portalSubdomainFor(host: string): PortalSubdomain | null {
  const incoming = bareHost(host);

  // Explicitly named portal hosts win: they are unrelated names (separate
  // Vercel projects), so no prefix arithmetic can recognise them.
  for (const portal of ALL_PORTALS) {
    const explicit = EXPLICIT_HOST[portal];
    if (explicit && incoming === bareHost(explicit)) return portal;
  }

  if (!APP_HOST) return null;
  const appHost = bareHost(APP_HOST);
  if (!incoming.endsWith(appHost)) return null;
  const prefix = incoming.slice(0, incoming.length - appHost.length);
  if (!prefix.endsWith(".")) return null;
  const label = prefix.slice(0, -1);
  return (ALL_PORTALS as readonly string[]).includes(label) ? (label as PortalSubdomain) : null;
}

export function pathPrefixFor(portal: PortalSubdomain): string {
  return PORTAL_PATH[portal];
}

/**
 * Drops a leading portal prefix so a nav href and the browser's pathname can
 * be compared.
 *
 * They don't otherwise match on a portal subdomain. Nav items are declared with
 * the canonical path ("/admin/orders") because that's the real route, but the
 * proxy REWRITES admin.<host>/orders to /admin/orders server-side — a rewrite,
 * not a redirect, so the address bar and therefore usePathname() stay at
 * "/orders". Comparing the two raw meant no sidebar item was ever marked
 * active and no group was ever opened on any portal subdomain; the shell
 * silently fell back to expanding the first group on every page.
 *
 * Normalising both sides makes the comparison correct under either routing
 * mode — subdomain (pathname "/orders") or path-based (pathname
 * "/admin/orders") both reduce to "/orders".
 */
export function stripPortalPrefix(path: string | undefined): string | undefined {
  if (!path) return path;
  for (const prefix of Object.values(PORTAL_PATH)) {
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  }
  return path;
}
