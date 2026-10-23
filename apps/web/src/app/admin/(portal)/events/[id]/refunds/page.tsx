import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getVenueAccess } from "@/modules/events/venue-access";
import { VenueRefundsView } from "@/modules/events/views/venue-refunds-view";

export const metadata: Metadata = { title: "Venue Refunds" };

export default async function AdminVenueRefundsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await getVenueAccess(id);
  if (!access) notFound();
  return <VenueRefundsView venueId={id} base={`/admin/events/${id}`} access={access} />;
}
