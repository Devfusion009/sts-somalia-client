import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Hotel, ChevronRight, PartyPopper } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyManagedHotels } from "@/modules/hotels/manager-queries";
import { getMyManagedVenues } from "@/modules/events/venue-manager-queries";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

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
      <main className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4">
        <Empty className="border border-border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>No property assigned</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/account" />}>My account</Button>
          </EmptyContent>
        </Empty>
      </main>
    );
  }

  if (properties.length === 1) redirect(properties[0].href);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Choose a property</h1>
      <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {properties.map((p) => (
          <li key={p.key}>
            <Link
              href={p.href}
              className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <p.icon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.place}</span>
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
