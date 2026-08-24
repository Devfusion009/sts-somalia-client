/**
 * The single registry of hotel-manager permissions. Adding a capability =
 * one entry here (plus, where it guards a table, one RLS policy calling
 * hotel_manager_has_permission) — the admin form, the manager portal nav,
 * and the server-action checks all render from this list.
 */
export const MANAGER_PERMISSIONS = [
  { key: "bookings", label: "Bookings" },
  { key: "rooms", label: "Rooms & rates" },
  { key: "availability", label: "Availability" },
  { key: "photos", label: "Photos & logo" },
  { key: "profile", label: "Hotel profile" },
] as const;

export type ManagerPermission = (typeof MANAGER_PERMISSIONS)[number]["key"];

export const MANAGER_PERMISSION_KEYS = MANAGER_PERMISSIONS.map((p) => p.key);

export function isManagerPermission(value: string): value is ManagerPermission {
  return (MANAGER_PERMISSION_KEYS as string[]).includes(value);
}
