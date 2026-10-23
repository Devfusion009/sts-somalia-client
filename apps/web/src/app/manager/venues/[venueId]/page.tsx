import { notFound } from "next/navigation";
import { venueCapacity } from "@sts/shared-types";
import { getVenueAccess } from "@/modules/events/venue-access";
import { getDeskVenue } from "@/modules/events/venue-manager-queries";
import { VenueDashboardView } from "@/modules/events/views/venue-dashboard-view";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

const VENUE_STATUS_BADGE: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

export default async function VenueManagerDashboard({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const [access, venue] = await Promise.all([getVenueAccess(venueId), getDeskVenue(venueId)]);
  if (!access || !venue) notFound();
  const capacity = venueCapacity(venue);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-heading text-2xl font-semibold">{venue.name}</h1>
          <Badge className={cn("border-transparent capitalize", VENUE_STATUS_BADGE[venue.status] ?? "bg-muted text-muted-foreground")}>
            {venue.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {venue.city}
          {capacity ? ` · up to ${capacity} guests` : ""}
        </p>
      </div>
      <VenueDashboardView venue={venue} base={`/manager/venues/${venueId}`} access={access} />
    </div>
  );
}
