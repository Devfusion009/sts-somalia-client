import Link from "next/link";
import { PartyPopper, CalendarCheck2, Clock, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  getMyVenuePartnerId,
  getMyVenues,
  getVenuePartnerStats,
} from "@/modules/events/venue-partner-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function VenueDashboardPage() {
  const profile = await requireUser();
  const partnerId = (await getMyVenuePartnerId(profile.id))!;
  const [venues, stats] = await Promise.all([getMyVenues(partnerId), getVenuePartnerStats(partnerId)]);

  const tiles = [
    { label: "Venues listed", value: venues.length, icon: PartyPopper },
    { label: "Pending requests", value: stats.pending, icon: Clock },
    { label: "Confirmed bookings", value: stats.confirmed, icon: CalendarCheck2 },
    { label: "Booked revenue", value: `$${stats.revenue.toFixed(2)}`, icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          Welcome back{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Manage your event venues and booking requests.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-3xl">
                <t.icon className="size-5 text-primary" /> {t.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">{t.label}</CardContent>
          </Card>
        ))}
      </div>

      {stats.pending > 0 ? (
        <Card className="border-brand-gold/50 bg-brand-gold/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm font-medium">
              {stats.pending} booking request{stats.pending > 1 ? "s" : ""} waiting for your decision.
            </p>
            <Button size="sm" render={<Link href="/venue/bookings" />}>
              Review requests
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {venues.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-medium">List your first venue</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Create your venue listing with capacity, pricing and event types. Our team reviews it before it
              goes live on the public Events &amp; Halls pages.
            </p>
            <Button render={<Link href="/venue/venues" />}>Add a venue</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
