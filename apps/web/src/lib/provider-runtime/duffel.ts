import "server-only";
import { getActiveProviderCredentials } from "./credentials";

/** DB-configured key takes precedence; falls back to the legacy DUFFEL_API_KEY env var. */
export async function resolveDuffelApiKey(): Promise<string | null> {
  const credentials = await getActiveProviderCredentials("duffel");
  if (credentials?.api_key) return credentials.api_key;
  return process.env.DUFFEL_API_KEY ?? null;
}

/** Lightweight real call used by the admin "Test Connection" button. */
export async function testDuffelConnection(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("https://api.duffel.com/air/airlines?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}`, "Duffel-Version": "v2" },
      cache: "no-store",
    });
    if (res.ok) return { ok: true, message: "Connected successfully." };
    if (res.status === 401) return { ok: false, message: "Authentication failed — check the API key." };
    return { ok: false, message: `Duffel returned an error (${res.status}).` };
  } catch {
    return { ok: false, message: "Could not reach Duffel." };
  }
}
