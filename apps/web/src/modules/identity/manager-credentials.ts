import "server-only";

/**
 * Credential handling shared by every manager seat (hotel and venue). Kept
 * out of the "use server" action files: those may only export async
 * functions that clients can call, and these must never be callable.
 */
export function generateTempPassword(): string {
  const raw = crypto.randomUUID().replace(/-/g, "");
  return `Sts-${raw.slice(0, 8)}-${raw.slice(8, 12)}`;
}

/**
 * The one seam for handing a manager their credentials. Today there is no
 * outbound email, so it returns the password for the caller to relay out of
 * band and the UI shows it exactly once. When email delivery lands, sending
 * the password (or an invite/reset link) from here flips every credential
 * path — create and reset, hotel and venue — in one place; return
 * `password: null` then and the UI stops rendering it.
 */
export async function deliverManagerCredentials(_email: string, password: string): Promise<{ password: string | null }> {
  return { password };
}
