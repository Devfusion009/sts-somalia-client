import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueCalendarView } from "@/modules/events/views/venue-calendar-view";

export const metadata: Metadata = { title: "Venue Calendar" };

export default async function AdminVenueCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ id }, { month }] = await Promise.all([params, searchParams]);
  const access = await getVenueAccess(id);
  if (!access) notFound();
  return <VenueCalendarView venueId={id} base={`/admin/events/${id}`} access={access} month={month} />;
}
