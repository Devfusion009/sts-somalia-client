import { jwtVerify, createRemoteJWKSet } from "jose";
import type { NextRequest } from "next/server";

/**
 * Reads and verifies the Supabase session from the raw request cookies, for use
 * in the proxy — before any React renders.
 *
 * WHY NOT createServerClient().getUser()
 * That is an HTTP call to the auth server on every request, and it still would
 * not answer "is this a platform admin" without a second call to the database.
 * Verifying the JWT locally against the cached JWKS is one network fetch for
 * the whole process lifetime, then pure CPU.
 *
 * WHAT THIS IS FOR
 * Failing fast at the origin boundary: an unauthenticated or non-admin request
 * to admin.<host> is turned away before the console boots. It is NOT the
 * authorization boundary — see the note in the migration that adds the claim.
 * Postgres RLS and requirePlatformAdmin() still gate every byte of data, and
 * both re-read the live column rather than trusting a token that may predate a
 * demotion.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Module scope so the key set is fetched once and cached for the process, not
// per request. jose handles re-fetching on unknown `kid` (key rotation).
const jwks = SUPABASE_URL
  ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
  : null;

/**
 * Verification can fail for two very different reasons, and conflating them is
 * a bug: a bad signature means "reject", but the JWKS being momentarily
 * unreachable (cold process, network blip, key rotation in flight) means "we
 * don't know". Treating the second as "no session" bounces a legitimate admin
 * to the login page on the first request after every cold start.
 */
export type EdgeSessionResult =
  | { kind: "none" }
  | { kind: "session"; session: EdgeSession }
  | { kind: "unverifiable" };

export type EdgeSession = {
  userId: string;
  email?: string;
  isPlatformAdmin: boolean;
  /** True when the token predates the claim hook, so the flag can't be trusted. */
  claimMissing: boolean;
};

/**
 * Supabase stores the session as `sb-<ref>-auth-token`, base64-encoded JSON.
 * Large sessions are split across `.0`, `.1`, … chunks, so the parts are
 * reassembled in index order before decoding.
 */
// supabase-js names the session cookie after the first hostname label of the
// URL it was created against (`sb-<label>-auth-token`), so a browser that has
// reached this app through two different Supabase hostnames — 127.0.0.1 from
// `next dev` and host.docker.internal from the Docker stack — carries two
// sb-*-auth-token cookies at once. Taking whichever one happens to sort first
// meant a stale, expired token from the other setup could shadow the live
// session and bounce a real admin to the login page in a loop. Prefer the
// cookie that belongs to the Supabase instance this deployment actually talks
// to; only fall back to "any" when that one isn't present at all.
const STORAGE_KEY = SUPABASE_URL
  ? `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`
  : null;

function readSessionCookie(request: NextRequest): string | null {
  const all = request.cookies.getAll();
  const own = STORAGE_KEY ? all.filter((c) => c.name === STORAGE_KEY || c.name.startsWith(`${STORAGE_KEY}.`)) : [];
  const pool = own.length > 0 ? own : all;

  const base = pool.filter((c) => /^sb-.*-auth-token$/.test(c.name));
  if (base.length > 0) return base[0].value;

  const chunks = pool
    .filter((c) => /^sb-.*-auth-token\.\d+$/.test(c.name))
    .sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop()));
  return chunks.length > 0 ? chunks.map((c) => c.value).join("") : null;
}

function accessTokenFrom(cookieValue: string): string | null {
  try {
    const raw = cookieValue.startsWith("base64-")
      ? Buffer.from(cookieValue.slice("base64-".length), "base64").toString("utf8")
      : decodeURIComponent(cookieValue);
    const parsed = JSON.parse(raw);
    return typeof parsed?.access_token === "string" ? parsed.access_token : null;
  } catch {
    // A malformed or truncated cookie is treated as no session at all rather
    // than throwing — a bad cookie must not 500 every page on the origin.
    return null;
  }
}

/** Never throws. See EdgeSessionResult for why this isn't just nullable. */
export async function readEdgeSession(request: NextRequest): Promise<EdgeSessionResult> {
  if (!jwks) return { kind: "unverifiable" };

  const cookie = readSessionCookie(request);
  if (!cookie) return { kind: "none" };

  const token = accessTokenFrom(cookie);
  if (!token) return { kind: "none" };

  try {
    // Signature and expiry are checked. An expired token is rejected here,
    // so the portal boundary can't be held open by a stale cookie the
    // browser happens to still be sending.
    //
    // Deliberately NOT constraining `issuer` here (an earlier version did,
    // pinned to `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1`) — that assumes
    // Supabase's own self-reported `iss` claim always equals whatever URL
    // this app uses to REACH Supabase, which isn't guaranteed. It broke
    // specifically in Docker: NEXT_PUBLIC_SUPABASE_URL has to be
    // host.docker.internal there (see docker-compose.yml) so the browser
    // and this container can both reach Supabase, but Supabase's actual
    // `iss` claim is fixed to its own local config (127.0.0.1) regardless
    // of which hostname a given client used to reach it — a real,
    // reproducible mismatch, confirmed via temporary diagnostic logging
    // ("unexpected iss claim value"). It happened to never surface outside
    // Docker only because NEXT_PUBLIC_SUPABASE_URL and Supabase's real
    // issuer coincidentally were the same string (both 127.0.0.1) there.
    // Signature verification against `jwks` — fetched from THIS specific
    // Supabase instance's JWKS endpoint — already proves the token was
    // genuinely issued by this instance; the issuer string is redundant on
    // top of that, not an additional real guarantee.
    const { payload } = await jwtVerify(token, jwks);

    const claim = payload.is_platform_admin;
    return {
      kind: "session",
      session: {
        userId: String(payload.sub ?? ""),
        email: typeof payload.email === "string" ? payload.email : undefined,
        isPlatformAdmin: claim === true,
        claimMissing: typeof claim !== "boolean",
      },
    };
  } catch (error) {
    // Only these are verdicts ABOUT THE TOKEN. Everything else — a failed
    // fetch to the JWKS, or ERR_JWKS_NO_MATCHING_KEY, which happens legitimately
    // while a signing key is rotating — says nothing about the caller and must
    // not be turned into a rejection, or key rotation would sign every admin out.
    const TOKEN_VERDICTS = new Set([
      "ERR_JWT_EXPIRED",
      "ERR_JWT_CLAIM_VALIDATION_FAILED",
      "ERR_JWT_INVALID",
      "ERR_JWS_INVALID",
      "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
    ]);
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === "string" && TOKEN_VERDICTS.has(code)
      ? { kind: "none" }
      : { kind: "unverifiable" };
  }
}
