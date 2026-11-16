import "server-only";
import { createHash, randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One-time two-factor recovery codes. Supabase Auth has none of its own, so
 * they live in public.mfa_recovery_codes as hashes that only the service role
 * can read. A code is ten characters (about 50 bits) from an alphabet without
 * look-alike characters, shown as XXXXX-XXXXX.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_COUNT = 10;

function normalize(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashCode(profileId: string, code: string) {
  return createHash("sha256").update(`${profileId}:${normalize(code)}`).digest("hex");
}

function newCode() {
  const chars = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`;
}

/** Replaces the account's recovery codes with a fresh set and returns them once, in plain text. */
export async function generateRecoveryCodes(profileId: string): Promise<string[]> {
  const admin = createAdminClient();
  const codes = Array.from({ length: CODE_COUNT }, newCode);
  await admin.from("mfa_recovery_codes").delete().eq("profile_id", profileId);
  const { error } = await admin
    .from("mfa_recovery_codes")
    .insert(codes.map((code) => ({ profile_id: profileId, code_hash: hashCode(profileId, code) })));
  if (error) throw new Error("Could not create recovery codes.");
  return codes;
}

export async function countUnusedRecoveryCodes(profileId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("mfa_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .is("used_at", null);
  if (error) throw new Error("Recovery codes could not be loaded.");
  return count ?? 0;
}

export async function deleteRecoveryCodes(profileId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("mfa_recovery_codes").delete().eq("profile_id", profileId);
}

/**
 * Spends one recovery code and removes every authenticator on the account, so
 * the signed-in password session no longer needs a second factor. The claim is
 * atomic: a code can only be spent once, even under concurrent attempts.
 */
export async function consumeRecoveryCode(profileId: string, code: string): Promise<{ ok: boolean }> {
  if (normalize(code).length !== 10) return { ok: false };
  const admin = createAdminClient();

  const { data: match } = await admin
    .from("mfa_recovery_codes")
    .select("id")
    .eq("profile_id", profileId)
    .eq("code_hash", hashCode(profileId, code))
    .is("used_at", null)
    .maybeSingle();
  if (!match) return { ok: false };

  const { data: claimed } = await admin
    .from("mfa_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", match.id)
    .is("used_at", null)
    .select("id");
  if (!claimed || claimed.length === 0) return { ok: false };

  const { data: factors } = await admin.auth.admin.mfa.listFactors({ userId: profileId });
  for (const factor of factors?.factors ?? []) {
    await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: profileId });
  }
  // The remaining codes belonged to the authenticators just removed.
  await admin.from("mfa_recovery_codes").delete().eq("profile_id", profileId).is("used_at", null);
  return { ok: true };
}
