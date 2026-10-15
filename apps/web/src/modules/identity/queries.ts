import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getMyPartnerId, getMyPartner } from "@/modules/hotels/partner-queries";
import { getMyManagedHotels } from "@/modules/hotels/manager-queries";
import { getMyManagedVenues } from "@/modules/events/venue-manager-queries";
import { getMyVenuePartnerId, getMyVenuePartner } from "@/modules/events/venue-partner-queries";
import { getMyPartnerAccountId } from "@/modules/admin/partner-accounts";
import { ACCOUNT_TYPE_LABEL, type PartnerAccountType, type PartnerAccountStatus } from "@/modules/admin/partner-account-shared";
import { portalHref } from "@/lib/subdomain";

/**
 * True for an identity that exists purely inside a staff console — a
 * platform admin, or a hotel/venue manager (an assigned seat, not an
 * account someone signed up with) — with no B2C account of its own behind
 * it. Every other role (agent, affiliate, hotel_partner, venue_partner,
 * plain customer) IS a real B2C account first and stays reachable there.
 *
 * Checked against the real hotel_managers row rather than profile.role,
 * since a manager assigned by any path that skips the admin promotion RPC
 * (seed data, notably) never gets that role column bumped. Used by
 * site-header.tsx and account/layout.tsx; signInAction (src/lib, which may
 * not depend on src/modules — see modules/README.md) keeps its own
 * equivalent check inline for the same reason.
 */
export async function isPortalOnlyIdentity(profile: { id: string; is_platform_admin: boolean }): Promise<boolean> {
  if (profile.is_platform_admin) return true;
  const [hotels, venues] = await Promise.all([getMyManagedHotels(profile.id), getMyManagedVenues(profile.id)]);
  return hotels.length > 0 || venues.length > 0;
}

export type PartnerContext = {
  type: PartnerAccountType;
  label: string;
  name: string;
  status: PartnerAccountStatus | null;
  href: string;
};

/** Every partner kind now has a subdomain lane (see roles.ts) — each runs through portalHref(). */
const PORTAL_HREF_FOR_TYPE: Record<PartnerAccountType, string> = {
  agency: portalHref("agent"),
  hotel_partner: portalHref("partner"),
  affiliate: portalHref("affiliate"),
  venue_partner: portalHref("venue"),
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
/**
 * Deliberately NOT calling into apps/api here even though `affiliates` has
 * migrated (phase 1) — this function is a cross-domain aggregator over
 * agencies/hotels/affiliates/events, and the other three still read Supabase
 * directly because their modules haven't migrated yet (agencies/hotels:
 * phase 5). `identity` itself doesn't migrate until phase 2, and even then
 * this specific aggregator can't fully move until its slowest dependency
 * does — routing just this one branch through a network hop while the
 * other three stay in-process would make this Promise.all's four branches
 * behave inconsistently for no benefit, on a check that runs on every
 * portal page load across all six portals. Revisit once every module this
 * function touches has migrated. One-line duplicate of what used to be
 * apps/web's modules/affiliates/queries.ts::getMyAffiliate.
 */
async function getMyAffiliateId(profileId: string): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("affiliates").select("id").eq("profile_id", profileId).maybeSingle();
  return data;
}

export async function getMyPartnerContexts(profileId: string, fallbackName: string | null): Promise<PartnerContext[]> {
  const [agency, hotelPartnerId, affiliate, venuePartnerId] = await Promise.all([
    getMyAgency(profileId),
    getMyPartnerId(profileId),
    getMyAffiliateId(profileId),
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

  return contexts;
}
