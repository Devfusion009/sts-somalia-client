import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database.types";
import { cookieDomain } from "@/lib/subdomain";

type CookieToSet = { name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] };

/**
 * Refreshes an expired Supabase session once, before anything renders.
 *
 * Server Components cannot write cookies, so without this a page with an
 * expired access token has every createClient() in the render refresh on its
 * own with the same single-use refresh token. The first wins; the rest get no
 * session and read as anon, which RLS turns into empty lists and 404s, and the
 * new tokens are thrown away so the next page repeats it.
 *
 * The fresh cookies are written onto `request` (so this render sees them) and
 * returned so the proxy can put them on whatever response it sends.
 */
export async function refreshSession(request: NextRequest): Promise<CookieToSet[]> {
  const written: CookieToSet[] = [];
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: { domain: cookieDomain() || undefined },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const cookie of cookiesToSet) {
            request.cookies.set(cookie.name, cookie.value);
            written.push(cookie);
          }
        },
      },
    }
  );
  try {
    // Verifies the token and refreshes it when expired; no network call for a
    // valid token on asymmetric signing keys.
    await supabase.auth.getClaims();
  } catch {
    // An unreachable auth server must not take every page down; the render's
    // own auth checks decide what to do.
  }
  return written;
}

/** Copies refreshed session cookies onto an outgoing proxy response. */
export function withSession<T extends NextResponse>(response: T, cookies: CookieToSet[]): T {
  for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
  return response;
}
