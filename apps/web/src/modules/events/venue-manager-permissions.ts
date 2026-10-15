/**
 * The single registry of venue-manager permissions — the venue counterpart
 * of hotels/manager-permissions.ts. Adding a capability = one entry here
 * (plus, where it guards a table, one RLS policy calling
 * venue_manager_has_permission); the assignment form, the portal nav and
 * the server-action checks all render from this list.
 */
export const VENUE_MANAGER_PERMISSIONS = [
  { key: "bookings", label: "Bookings" },
  { key: "calendar", label: "Blocked dates" },
  { key: "photos", label: "Photos" },
  { key: "profile", label: "Venue profile" },
] as const;

export type VenueManagerPermission = (typeof VENUE_MANAGER_PERMISSIONS)[number]["key"];

export const VENUE_MANAGER_PERMISSION_KEYS = VENUE_MANAGER_PERMISSIONS.map((p) => p.key);

export function isVenueManagerPermission(value: string): value is VenueManagerPermission {
  return (VENUE_MANAGER_PERMISSION_KEYS as string[]).includes(value);
}
