import { notFound } from "next/navigation";
import { venueCapacity } from "@sts/shared-types";
import { getVenueAccess } from "@/modules/events/venue-access";
import { getDeskVenue } from "@/modules/events/venue-manager-queries";
import { VenueDashboardView } from "@/modules/events/views/venue-dashboard-view";
import { priceUnitLabel, venueMoney } from "@/modules/events/components/amenities";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Dashboard" };

export default async function VenueManagerDashboard({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const [access, venue] = await Promise.all([getVenueAccess(venueId), getDeskVenue(venueId)]);
  if (!access || !venue) notFound();
  const capacity = venueCapacity(venue);
  const meta = [
    venue.city,
    capacity ? `up to ${capacity} guests` : null,
    Number(venue.base_price) > 0 ? `${venueMoney(venue.currency, venue.base_price)} ${priceUnitLabel(venue.price_unit)}` : "Price on request",
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={venue.name}
        status={
          <Badge variant={statusBadgeVariant(venue.status)} className="capitalize">
            {venue.status.replace(/_/g, " ")}
          </Badge>
        }
        meta={<span className="tabular-nums">{meta.join(" · ")}</span>}
      />
      <VenueDashboardView venue={venue} base={`/manager/venues/${venueId}`} access={access} />
    </div>
  );
}
