import "server-only";

/** Lightweight real call used by the admin "Test Connection" button. */
export async function testDuffelConnection(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch("https://api.duffel.com/air/airlines?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}`, "Duffel-Version": "v2" },
      cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) return { ok: true, message: "Authentication verified. Flight booking uses your Duffel balance." };
    if (res.status === 401) return { ok: false, message: "Authentication failed — check the API key." };
    return { ok: false, message: `Duffel returned an error (${res.status}).` };
  } catch {
    return { ok: false, message: "Could not reach Duffel." };
  }
}
