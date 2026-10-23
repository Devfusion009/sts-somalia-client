import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { getDeskVenue } from "@/modules/events/venue-manager-queries";
import { VenueDashboardView } from "@/modules/events/views/venue-dashboard-view";

export const metadata: Metadata = { title: "Venue" };

export default async function AdminVenueOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [access, venue] = await Promise.all([getVenueAccess(id), getDeskVenue(id)]);
  if (!access || !venue) notFound();
  return <VenueDashboardView venue={venue} base={`/admin/events/${id}`} access={access} />;
}
