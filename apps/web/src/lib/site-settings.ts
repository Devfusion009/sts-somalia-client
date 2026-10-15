import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { cachedRead, getRedisClient } from "@/lib/redis";
import { SOCIAL_PLATFORMS, type SocialLink, type SocialPlatform } from "@/lib/social-platforms";

/**
 * Site-wide settings an admin edits directly, stored as one row per key in
 * platform_settings. Read with the service-role client because the public
 * footer and the checkout both need them for anonymous visitors, and the
 * table is admin-only under RLS.
 */

const SOCIAL_KEY = "social_links";
const BANK_KEY = "bank_transfer";
const TTL_SECONDS = 300;

export type BankTransferDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
};

const BANK_FALLBACK: BankTransferDetails = {
  bankName: process.env.BANK_TRANSFER_BANK_NAME ?? "Premier Bank",
  accountName: process.env.BANK_TRANSFER_ACCOUNT_NAME ?? "Scout Travel Solution LTD",
  accountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER ?? "020160002200",
};

async function readSetting(key: string): Promise<unknown> {
  const admin = createAdminClient();
  const { data } = await admin.from("platform_settings").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

function isPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && value in SOCIAL_PLATFORMS;
}

export async function getSocialLinks(): Promise<SocialLink[]> {
  return cachedRead(`settings:${SOCIAL_KEY}`, TTL_SECONDS, async () => {
    const raw = await readSetting(SOCIAL_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry): SocialLink[] => {
      const e = entry as { platform?: unknown; url?: unknown };
      return isPlatform(e.platform) && typeof e.url === "string" && e.url ? [{ platform: e.platform, url: e.url }] : [];
    });
  }).catch(() => []);
}

export async function getBankTransfer(): Promise<BankTransferDetails> {
  return cachedRead(`settings:${BANK_KEY}`, TTL_SECONDS, async () => {
    const raw = (await readSetting(BANK_KEY)) as Partial<BankTransferDetails> | null;
    return {
      bankName: raw?.bankName || BANK_FALLBACK.bankName,
      accountName: raw?.accountName || BANK_FALLBACK.accountName,
      accountNumber: raw?.accountNumber || BANK_FALLBACK.accountNumber,
    };
  }).catch(() => BANK_FALLBACK);
}

/** Drops the cached copy so the next read, on any page, sees the saved value. */
export async function invalidateSetting(key: "social_links" | "bank_transfer"): Promise<void> {
  try {
    await getRedisClient()?.del(`settings:${key}`);
  } catch {
    // Cache is an optimisation; the TTL covers a missed delete.
  }
}
