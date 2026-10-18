import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotel } from "@/modules/hotels/manager-queries";
import type { ManagerPermission } from "@/modules/hotels/manager-permissions";

export type HotelAccess = {
  profileId: string;
  hotelId: string;
  isAdmin: boolean;
  can: (permission: ManagerPermission) => boolean;
};

/**
 * Who may work one hotel's desk: a platform admin (every permission), or an
 * active manager of this hotel (the permissions admin granted). Null for
 * anyone else. RLS enforces the same boundary again on every row.
 */
export async function getHotelAccess(hotelId: string): Promise<HotelAccess | null> {
  const profile = await requireUser();
  if (profile.is_platform_admin) {
    return { profileId: profile.id, hotelId, isAdmin: true, can: () => true };
  }
  const managed = await getMyManagedHotel(profile.id, hotelId);
  if (!managed) return null;
  return {
    profileId: profile.id,
    hotelId,
    isAdmin: false,
    can: (permission) => managed.permissions.includes(permission),
  };
}

/** The access, only when it carries `permission`. */
export async function requireHotelPermission(hotelId: string, permission: ManagerPermission) {
  const access = await getHotelAccess(hotelId);
  return access && access.can(permission) ? access : null;
}

/** Both consoles that show one hotel's desk: the manager portal and the admin hotel pages. */
export function revalidateHotelDesk(hotelId: string) {
  revalidatePath(`/manager/${hotelId}`, "layout");
  revalidatePath(`/admin/hotels/${hotelId}`, "layout");
}
