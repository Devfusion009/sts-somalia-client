import "server-only";
import { createHash } from "node:crypto";

/**
 * New-password checks, after NIST SP 800-63B: a length floor and ceiling, no
 * composition rules, no password built from the account's own name or email,
 * and none that already appears in a known data breach.
 */

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt (Supabase Auth) reads at most 72 bytes; anything longer is silently truncated. */
export const PASSWORD_MAX_BYTES = 72;

/** Context words a password must not contain: the email's local part and name parts of 4+ characters. */
function contextWords(context: { email?: string | null; fullName?: string | null }) {
  const words = new Set<string>();
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4) words.add(local);
  for (const part of (context.fullName ?? "").toLowerCase().split(/\s+/)) {
    if (part.length >= 4) words.add(part);
  }
  words.add("stssomalia");
  return [...words];
}

export function checkPasswordRules(
  password: string,
  context: { email?: string | null; fullName?: string | null }
): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return "Use 72 characters or fewer.";
  if (/^(.)\1+$/.test(password)) return "Avoid repeating a single character.";
  const lower = password.toLowerCase();
  if (contextWords(context).some((word) => lower.includes(word))) return "Avoid using your name or email in your password.";
  return null;
}

/**
 * Pwned Passwords range lookup (k-anonymity): only the first 5 hex characters
 * of the SHA-1 hash leave the server, with response padding on. Returns
 * whether the password appears in a known breach; null when the service could
 * not be reached in time, so an outage never blocks a password change.
 */
export async function isPasswordBreached(password: string): Promise<boolean | null> {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "STS-Somalia-Account-Security" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [candidate, count] = line.trim().split(":");
      return candidate === suffix && Number(count) > 0;
    });
  } catch {
    return null;
  }
}
