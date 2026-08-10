import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Native Supabase TOTP MFA (auth.mfa.*) — not a bespoke TOTP implementation.
 * Verified working against the local Supabase CLI stack with zero billing
 * gate; the "Pro plan" note in supabase/config.toml describes the HOSTED
 * dashboard's self-serve toggle, not a restriction on the open-source
 * GoTrue auth server itself. Confirm the equivalent hosted-project setting
 * (Authentication → MFA → TOTP) before relying on this in production.
 *
 * AAL (Authenticator Assurance Level): aal1 = password only, aal2 = password
 * + a verified second factor completed this session. A user can have a
 * verified TOTP factor on file yet still be sitting at aal1 if they haven't
 * completed the challenge in the current session — that gap is what
 * requireMfaSatisfied() closes.
 */

/** True if the signed-in user must complete a pending MFA challenge before proceeding. */
export async function mfaChallengePending(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!data) return false;
  return data.currentLevel === "aal1" && data.nextLevel === "aal2";
}

/** Verified TOTP factors on the current user's account (for the security settings page). */
export async function listVerifiedFactors() {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp.filter((f) => f.status === "verified") ?? [];
}
