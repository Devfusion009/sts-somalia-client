import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { venueCapacity } from "@sts/shared-types";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getVenueByIdAdmin } from "@/modules/admin/queries";
import { getPendingHallBookingCount } from "@/modules/events/venue-manager-queries";
import { getOpenVenueRequestCount } from "@/modules/events/venue-refund-queries";
import { priceUnitLabel, venueMoney } from "@/modules/events/components/amenities";
import { BackLink } from "@/components/back-link";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VenueForm } from "../venue-form";
import { VenueTabs } from "./venue-tabs";

/** Header and section tabs shared by every page of one venue in the admin console. */
export default async function AdminVenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePlatformAdmin();
  const [venue, requests, refunds] = await Promise.all([
    getVenueByIdAdmin(id),
    getPendingHallBookingCount(id),
    getOpenVenueRequestCount(id),
  ]);
  if (!venue) notFound();

  const capacity = venueCapacity(venue);
  const meta = [
    venue.city,
    capacity ? `up to ${capacity} guests` : null,
    Number(venue.base_price) > 0 ? `${venueMoney(venue.currency, venue.base_price)} ${priceUnitLabel(venue.price_unit)}` : "Price on request",
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-4">
        <BackLink href="/admin/events" label="All venues" />
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="min-w-0 font-heading text-2xl font-semibold tracking-tight break-words">{venue.name}</h1>
              <Badge variant={statusBadgeVariant(venue.status)} className="capitalize">
                {venue.status.replace(/_/g, " ")}
              </Badge>
              {venue.is_featured ? <Badge variant="info">Featured</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">{meta.join(" · ")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {venue.status === "published" ? (
              <Button
                variant="outline"
                size="icon"
                aria-label="Open public page"
                title="Open public page"
                render={<a href={`/events/${venue.slug}`} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink />
              </Button>
            ) : null}
            <VenueForm venue={venue} />
          </div>
        </header>
        <VenueTabs id={id} counts={{ requests, refunds }} />
      </div>
      {children}
    </div>
  );
}
