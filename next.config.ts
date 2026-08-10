import type { NextConfig } from "next";

// Dev-mode only (no effect on production builds — see allowedDevOrigins
// below). When portal subdomains are configured (NEXT_PUBLIC_APP_HOST set,
// see src/lib/subdomain.ts), the dev server needs to be told that host —
// and admin./agent. under it — is allowed to talk to it at all in dev mode.
const appHost = process.env.NEXT_PUBLIC_APP_HOST?.split(":")[0];

const nextConfig: NextConfig = {
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
    // Silences "Next.js inferred your workspace root..." (a stray lockfile
    // one level up, at /home/subhadip-sasmal/package-lock.json, unrelated
    // to this project, makes Turbopack guess wrong without this).
    //
    // MUST be the bare `__dirname` identifier, NOT `path.join(__dirname)` —
    // they're the identical string at runtime, but path.join(__dirname)
    // silently breaks proxy.ts entirely in this Next.js version (16.2.12):
    // the build still reports "ƒ Proxy (Middleware)" and compiles it, but
    // it never actually runs at request time — no rewrite, no block, no
    // debug header, nothing, with zero error anywhere. Cost a long
    // debugging session to isolate down to this one call vs. bare
    // identifier difference. Re-test this (curl -I and look for a header
    // your proxy sets) before ever changing this line again.
    root: __dirname,
  },
  experimental: {
    serverActions: {
      // Server Actions cap request bodies at 1MB by default — well under the
      // 5MB per-file limit the partner-application document upload already
      // enforces (src/modules/partner-applications/actions.ts), so real KYC
      // scans/photos above 1MB were rejected by Next.js itself before our
      // own validation ever ran. Matches that 5MB cap with headroom for
      // multipart overhead.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
