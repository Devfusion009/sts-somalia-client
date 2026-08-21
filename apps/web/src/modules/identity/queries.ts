import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getMyPartnerId, getMyPartner } from "@/modules/hotels/partner-queries";
import { getMyAffiliate } from "@/modules/affiliates/queries";
import { getMyVenuePartnerId, getMyVenuePartner } from "@/modules/events/venue-partner-queries";
import { getMyPartnerAccountId } from "@/modules/admin/partner-accounts";
import { ACCOUNT_TYPE_LABEL, type PartnerAccountType, type PartnerAccountStatus } from "@/modules/admin/partner-account-shared";
import { portalHref } from "@/lib/subdomain";

export type PartnerContext = {
  type: PartnerAccountType;
  label: string;
  name: string;
  status: PartnerAccountStatus | null;
  href: string;
};

/**
 * hotel_partner/affiliate/venue_partner stay path-based forever (see
 * roles.ts); agency is the one kind that goes cross-origin once portal
 * subdomains are configured, so it alone runs through portalHref().
 */
const PORTAL_HREF_FOR_TYPE: Record<PartnerAccountType, string> = {
  agency: portalHref("agent"),
  hotel_partner: "/partner",
  affiliate: "/affiliate",
  venue_partner: "/venue",
};

async function statusFor(type: PartnerAccountType, entityId: string): Promise<PartnerAccountStatus | null> {
  const accountId = await getMyPartnerAccountId(type, entityId);
  if (!accountId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("partner_accounts").select("status").eq("id", accountId).maybeSingle();
  return (data?.status as PartnerAccountStatus | undefined) ?? null;
}

/**
 * Every partner identity this profile currently holds, across all four
 * program kinds — the discovery layer behind the account switcher (header
 * dropdown, /account banner, PortalShell sidebar footer). `profiles.role` is
 * a single column that gets overwritten by each new approval, so it can
 * only ever name one of these; this reads the real per-kind membership
 * tables instead, the same source of truth access control already uses.
 *
 * Lives in modules/identity (not lib/auth, where it was originally written)
 * because it's a cross-domain aggregator over agencies/hotels/affiliates/
 * events/admin — exactly what modules/README.md's "lib never depends on
 * modules" rule exists to keep out of lib. A module depending on other
 * modules' public files is the allowed direction.
 *
 * Adding a fifth partner kind later means one more parallel lookup below,
 * one more `candidates.push`, and one more PORTAL_HREF_FOR_TYPE entry — no
 * caller of this function needs to change.
 */
/** Hotel names this profile was directly assigned to manage (hotel_managers,
 * active rows only) — not a hotel_partner business member, see below. */
async function getMyManagedHotelNames(profileId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hotel_managers")
    .select("hotel:hotels(name)")
    .eq("profile_id", profileId)
    .eq("status", "active");
  return (data ?? []).map((r) => r.hotel?.name).filter((n): n is string => !!n);
}

export async function getMyPartnerContexts(profileId: string, fallbackName: string | null): Promise<PartnerContext[]> {
  const [agency, hotelPartnerId, affiliate, venuePartnerId] = await Promise.all([
    getMyAgency(profileId),
    getMyPartnerId(profileId),
    getMyAffiliate(profileId),
    getMyVenuePartnerId(profileId),
  ]);

  const [hotelPartner, venuePartner] = await Promise.all([
    hotelPartnerId ? getMyPartner(hotelPartnerId) : null,
    venuePartnerId ? getMyVenuePartner(venuePartnerId) : null,
  ]);

  const candidates: { type: PartnerAccountType; entityId: string; name: string }[] = [];
  if (agency) candidates.push({ type: "agency", entityId: agency.agency.id, name: agency.agency.name });
  if (hotelPartner) candidates.push({ type: "hotel_partner", entityId: hotelPartner.id, name: hotelPartner.name });
  if (affiliate) candidates.push({ type: "affiliate", entityId: affiliate.id, name: fallbackName || "Affiliate Program" });
  if (venuePartner) candidates.push({ type: "venue_partner", entityId: venuePartner.id, name: venuePartner.name });

  const withStatus = await Promise.all(
    candidates.map(async (c) => ({ ...c, status: await statusFor(c.type, c.entityId) }))
  );

  const contexts = withStatus
    .filter((c) => c.status !== "offboarded")
    .map((c) => ({
      type: c.type,
      label: ACCOUNT_TYPE_LABEL[c.type],
      name: c.name,
      status: c.status,
      href: PORTAL_HREF_FOR_TYPE[c.type],
    }));

  // A hotel_manager has no hotel_partners business (no application, no
  // partner_accounts row) — it's an admin-assigned hotel_managers row, so it
  // can't come from the candidates/statusFor machinery above. Only surfaced
  // when they're not already a real hotel_partner member: that card already
  // opens /partner and (via getMyHotelScope) already lists every hotel they
  // manage alongside the ones their business owns — no information is lost
  // by not doubling it up here.
  if (!hotelPartner) {
    const managedHotels = await getMyManagedHotelNames(profileId);
    if (managedHotels.length > 0) {
      contexts.push({
        type: "hotel_partner",
        label: "Hotel Manager",
        name: managedHotels.join(", "),
        status: "live",
        href: "/partner",
      });
    }
  }

  return contexts;
}
