import path from "node:path";
import type { NextConfig } from "next";

// Dev-mode only (no effect on production builds — see allowedDevOrigins
// below). When portal subdomains are configured (NEXT_PUBLIC_APP_HOST set,
// see src/lib/subdomain.ts), the dev server needs to be told that host —
// and admin./agent. under it — is allowed to talk to it at all in dev mode.
const appHost = process.env.NEXT_PUBLIC_APP_HOST?.split(":")[0];

const nextConfig: NextConfig = {
  // Traces the minimal set of files this app actually needs at runtime
  // into .next/standalone (no full node_modules, no source) — what the
  // Dockerfile's runner stage copies. Without this, a Docker image would
  // have to ship the entire node_modules tree. No effect outside `next
  // build`/Docker; `next dev` ignores it. See
  // node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md
  output: "standalone",
  poweredByHeader: false,
  images: {
    // Optimized variants are reused for 30 days instead of the 4-hour default.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    // Media in public/ is replaced by uploading a new file name, so it can be cached for a week.
    const media = "public, max-age=604800, stale-while-revalidate=86400";
    return [
      { source: "/marketing/:path*", headers: [{ key: "Cache-Control", value: media }] },
      { source: "/about/:path*", headers: [{ key: "Cache-Control", value: media }] },
    ];
  },
  // Next.js blocks cross-origin requests to dev-only assets/endpoints from
  // any host other than localhost by default (a real security feature —
  // prevents a malicious page from reaching your dev server via DNS
  // rebinding). Without this, visiting the app via a custom local domain
  // (e.g. admin.stssomalia.test while testing portal subdomains) silently
  // breaks: the HMR websocket gets rejected, and — this is the expensive
  // part to rediscover — client-side hydration fails *completely* on that
  // origin with zero error anywhere. Every onClick handler on the page
  // just does nothing, no console error, no failed network request, no
  // React error overlay. If that symptom ever reappears, check this first
  // before suspecting the proxy or the component. Only matters in dev —
  // production has no such restriction (it's not a browser CORS thing).
  allowedDevOrigins: appHost ? [appHost, `*.${appHost}`] : undefined,
  turbopack: {
    // Was the bare `__dirname` identifier pre-monorepo-split, when this
    // file lived at the repo root — an earlier debugging session found
    // that wrapping it (path.join(__dirname), even with zero effective
    // path change) silently broke proxy.ts's execution in this Next.js
    // version, so that comment insisted on the bare form. Now that this
    // file lives at apps/web/next.config.ts, `__dirname` alone is the
    // wrong value (it's apps/web, not the workspace root Turbopack needs
    // to resolve the hoisted `next` package from — see the "couldn't find
    // next/package.json" error this fixes) and auto-detection also picks
    // the wrong lockfile (an unrelated one further up the home directory),
    // so an explicit two-levels-up path is unavoidable here. This is
    // Next's own documented pattern for exactly this monorepo layout (see
    // node_modules/next/dist/docs/.../turbopack.md, "Root directory").
    // VERIFIED after this change: proxy.ts's isolated-portal 404 still
    // fires (curl -H "Host: stssomalia.test:3000" .../admin → plain-text
    // 404, not the admin page) — re-run that check before trusting this
    // line if it's ever touched again.
    root: path.join(__dirname, "..", ".."),
  },
  experimental: {
    serverActions: {
      // Server Actions cap request bodies at 1MB by default — well under the
      // 5MB per-file limit the partner-application document upload already
      // enforces (src/modules/partner-applications/actions.ts), so real KYC
      // scans/photos above 1MB were rejected by Next.js itself before our
      // own validation ever ran. Sized for the largest single upload: the
      // property gallery accepts videos up to 20MB, sent one file per request.
      bodySizeLimit: "24mb",
    },
  },
};

export default nextConfig;
