import "server-only";
import type { UmrahBookingsFilter } from "@sts/shared-types";
import { getServerTrpc } from "@/lib/trpc/server";

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

/** Everything the admin booking page shows, with signed document links. */
export async function getUmrahBookingAdmin(id: string) {
  const trpc = await getServerTrpc({ timeoutMs: 10000 });
  return trpc.umrah.admin.bookings.detail.query({ bookingId: id });
}
