import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedVenue } from "@/modules/events/venue-manager-queries";
import type { VenueManagerPermission } from "@/modules/events/venue-manager-permissions";

export type VenueAccess = {
  profileId: string;
  venueId: string;
  isAdmin: boolean;
  can: (permission: VenueManagerPermission) => boolean;
};

/** A platform admin (every permission) or an active manager of this venue (granted permissions). */
export async function getVenueAccess(venueId: string): Promise<VenueAccess | null> {
  const profile = await requireUser();
  if (profile.is_platform_admin) {
    return { profileId: profile.id, venueId, isAdmin: true, can: () => true };
  }
  const managed = await getMyManagedVenue(profile.id, venueId);
  if (!managed) return null;
  return {
    profileId: profile.id,
    venueId,
    isAdmin: false,
    can: (permission) => managed.permissions.includes(permission),
  };
}

export async function requireVenueAccess(venueId: string, permission: VenueManagerPermission) {
  const access = await getVenueAccess(venueId);
  return access && access.can(permission) ? access : null;
}

/** Every console that shows one venue's desk. */
export function revalidateVenueDesk(venueId: string) {
  revalidatePath(`/manager/venues/${venueId}`, "layout");
  revalidatePath(`/admin/events/${venueId}`, "layout");
  revalidatePath("/admin/events");
  revalidatePath("/admin/queue");
  revalidatePath("/admin/refunds");
  revalidatePath("/venue/bookings");
}
