import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import type { MeResult } from "@sts/shared-types";

/**
 * Phase-0 proof page for the modular-monolith split — not a real product
 * page. Confirms the full loop: this session's Supabase access token is
 * forwarded to apps/api, which re-derives RLS access from that token alone
 * and returns this same user's own profile data. Remove once a real module
 * has migrated and exercises the same path.
 */
export default async function ApiHealthPage() {
  await requireUser();

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return <p>No session — sign in and reload.</p>;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  let result: MeResult | null = null;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(`${apiUrl}/health/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      errorMessage = `apps/api responded ${res.status}: ${await res.text()}`;
    } else {
      result = (await res.json()) as MeResult;
    }
  } catch (err) {
    errorMessage = `Could not reach apps/api at ${apiUrl}: ${(err as Error).message}`;
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace", fontSize: "0.9rem" }}>
      <h1>apps/api round trip</h1>
      <p>apps/api URL: {apiUrl}</p>
      {errorMessage ? (
        <p style={{ color: "crimson" }}>{errorMessage}</p>
      ) : (
        <pre>{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}
