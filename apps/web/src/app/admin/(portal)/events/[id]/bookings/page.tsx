import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueBookingsView } from "@/modules/events/views/venue-bookings-view";

export const metadata: Metadata = { title: "Venue Bookings" };

export default async function AdminVenueBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const [{ id }, { view, q }] = await Promise.all([params, searchParams]);
  const access = await getVenueAccess(id);
  if (!access) notFound();
  return <VenueBookingsView venueId={id} base={`/admin/events/${id}`} access={access} view={view} q={q} />;
}
