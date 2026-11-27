import "server-only";
import type { UmrahBookingsFilter } from "@sts/shared-types";
import { getServerTrpc } from "@/lib/trpc/server";
import { createClient } from "@/lib/supabase/server";
import type { UmrahPoolRow } from "@/modules/umrah/pool";
import type { SupabaseClient } from "@supabase/supabase-js";

export const UMRAH_DOCUMENTS_BUCKET = "umrah-documents";

export type UmrahPaymentFilter = NonNullable<UmrahBookingsFilter["payment"]>;

export async function getUmrahBookingsAdmin(filters: Partial<UmrahBookingsFilter>) {
  const trpc = await getServerTrpc();
  return trpc.umrah.admin.bookings.list.query({ ...filters, page: filters.page ?? 1 });
}

/** Packages and departures for the list filters. */
export async function getUmrahFilterOptions() {
  const trpc = await getServerTrpc();
  return trpc.umrah.admin.bookings.filterOptions.query();
}

/** Live pool totals for the Umrah orders workspace and order detail. */
export async function getUmrahPoolCapacityAdmin(): Promise<UmrahPoolRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_public_umrah_pool");
  if (error) throw new Error("Umrah pool capacity could not be loaded.");
  return (data ?? []) as unknown as UmrahPoolRow[];
}

export type SelectedUmrahCapacity = Pick<UmrahPoolRow, "package_id" | "departure_id" | "total_seats" | "offline_seats" | "confirmed_seats" | "held_seats" | "formation_status">;

/** Capacity only for the departures visible in the current admin view. */
export async function getSelectedUmrahCapacityAdmin(departureIds: string[]): Promise<SelectedUmrahCapacity[]> {
  if (departureIds.length === 0) return [];
  const ids = [...new Set(departureIds)];
  if (ids.length > 50) throw new Error("Too many Umrah departures selected.");
  const supabase = (await createClient()) as unknown as SupabaseClient;
  const { data, error } = await supabase.rpc("admin_umrah_capacity_for_departures", { p_departure_ids: ids });
  if (error) throw new Error("Umrah pool capacity could not be loaded.");
  return (data ?? []) as SelectedUmrahCapacity[];
}

/** Everything the admin booking page shows, with signed document links. */
export async function getUmrahBookingAdmin(id: string) {
  const trpc = await getServerTrpc({ timeoutMs: 10000 });
  return trpc.umrah.admin.bookings.detail.query({ bookingId: id });
}
