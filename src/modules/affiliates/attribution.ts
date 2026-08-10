import "server-only";
import { cookies } from "next/headers";

/**
 * Attribution cookie contract shared by the /r/[code] click route (writer)
 * and order creation (reader). Value: "<affiliateId>:<clickId>:<visitorId>",
 * last click wins, 30-day window.
 */
export const AFFILIATE_COOKIE = "sts_aff";

export type AffiliateAttribution = {
  affiliateId: string;
  clickId: string | null;
};

export async function getAffiliateAttribution(): Promise<AffiliateAttribution | null> {
  const store = await cookies();
  const raw = store.get(AFFILIATE_COOKIE)?.value;
  if (!raw) return null;

  const [affiliateId, clickId] = raw.split(":");
  if (!affiliateId) return null;

  return { affiliateId, clickId: clickId || null };
}
