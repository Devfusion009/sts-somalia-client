import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { venueCapacity } from "@sts/shared-types";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { getVenueByIdAdmin } from "@/modules/admin/queries";
import { getPendingHallBookingCount } from "@/modules/events/venue-manager-queries";
import { getOpenVenueRequestCount } from "@/modules/events/venue-refund-queries";
import { priceUnitLabel, venueMoney } from "@/modules/events/components/amenities";
import { BackLink } from "@/components/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VenueForm } from "../venue-form";
import { VenueTabs } from "./venue-tabs";

const STATUS_STYLE: Record<string, string> = {
  published: "bg-primary/10 text-primary",
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-brand-gold/15 text-brand-gold",
  suspended: "bg-destructive/10 text-destructive",
};

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-heading text-2xl font-semibold">{venue.name}</h1>
              <Badge className={cn("border-transparent capitalize", STATUS_STYLE[venue.status] ?? "bg-muted text-muted-foreground")}>
                {venue.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{meta.join(" · ")}</p>
          </div>
          <div className="flex items-center gap-2">
            {venue.status === "published" ? (
              <Button
                variant="outline"
                size="icon"
                aria-label="Open public page"
                render={<a href={`/events/${venue.slug}`} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink className="size-4" />
              </Button>
            ) : null}
            <VenueForm venue={venue} />
          </div>
        </div>
        <VenueTabs id={id} counts={{ requests, refunds }} />
      </div>
      {children}
    </div>
  );
}
