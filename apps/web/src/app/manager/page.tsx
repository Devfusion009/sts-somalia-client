import Link from "next/link";
import { redirect } from "next/navigation";
import { Hotel, ChevronRight, PartyPopper } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotels } from "@/modules/hotels/manager-queries";
import { getMyManagedVenues } from "@/modules/events/venue-manager-queries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Portal entry for hotel and venue managers. One assignment — the common
 * case — goes straight to that property's dashboard; several get a picker;
 * none gets a dead-end card.
 */
export default async function ManagerEntryPage() {
  const profile = await requireUser();
  const [hotels, venues] = await Promise.all([getMyManagedHotels(profile.id), getMyManagedVenues(profile.id)]);

  const properties = [
    ...hotels.map((h) => ({
      key: `h-${h.hotelId}`,
      href: `/manager/${h.hotelId}`,
      name: h.hotel.name,
      place: `${h.hotel.city}, ${h.hotel.country_code}`,
      icon: Hotel,
    })),
    ...venues.map((v) => ({
      key: `v-${v.venueId}`,
      href: `/manager/venues/${v.venueId}`,
      name: v.venue.name,
      place: `${v.venue.city}, ${v.venue.country_code}`,
      icon: PartyPopper,
    })),
  ];

  if (properties.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
        <Card>
          <CardContent className="space-y-3 p-6 text-center">
            <p className="font-medium">No property assignment found</p>
            <Button render={<Link href="/account" />}>Go to My Account</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (properties.length === 1) redirect(properties[0].href);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-4 py-10">
      <h1 className="font-heading text-xl font-semibold">Choose a property</h1>
      {properties.map((p) => (
        <Link
          key={p.key}
          href={p.href}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
        >
          <span className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <p.icon className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">{p.name}</span>
              <span className="block text-xs text-muted-foreground">{p.place}</span>
            </span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>
      ))}
    </div>
  );
}
