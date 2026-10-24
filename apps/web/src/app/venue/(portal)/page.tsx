import Link from "next/link";
import { ArrowRight, PartyPopper } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyVenuePartnerId,
  getMyVenues,
  getVenuePartnerStats,
} from "@/modules/events/venue-partner-queries";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money } from "@/lib/money";

export default async function VenueDashboardPage() {
  const profile = await requireUser();
  const partnerId = (await getMyVenuePartnerId(profile.id))!;
  const [venues, stats] = await Promise.all([getMyVenues(partnerId), getVenuePartnerStats(partnerId)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        actions={
          stats.pending > 0 ? (
            <Button render={<Link href="/venue/bookings" />}>
              Review requests
              <Badge variant="secondary" className="tabular-nums">
                {stats.pending}
              </Badge>
            </Button>
          ) : null
        }
      />

      <StatRail>
        <StatRailItem label="Venues listed" value={venues.length} />
        <StatRailItem label="Pending requests" value={stats.pending} tone={stats.pending > 0 ? "warn" : undefined} />
        <StatRailItem label="Confirmed bookings" value={stats.confirmed} />
        <StatRailItem label="Booked revenue" value={money(stats.revenue, "USD")} />
      </StatRail>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Venues</CardTitle>
          {venues.length > 0 ? (
            <CardAction>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Open my venues"
                title="My venues"
                render={<Link href="/venue/venues" />}
              >
                <ArrowRight />
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {venues.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <PartyPopper />
              </EmptyMedia>
              <EmptyTitle>No venues</EmptyTitle>
              <EmptyContent>
                <Button render={<Link href="/venue/venues" />}>Add a venue</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {venues.map((venue) => (
                <li key={venue.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{venue.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{venue.city}</p>
                  </div>
                  <Badge variant={statusBadgeVariant(venue.status)} className="shrink-0 capitalize">
                    {venue.status.replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
