import { AgentMoney } from "@/components/portal/agent-money";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ArrowRight, Hotel, MapPin, Search, Star } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomer } from "@/modules/agencies/booking-context";
import { searchHotels } from "@/modules/hotels/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/money";
export const metadata = { title: "Hotels" };

export default async function AgentHotelDeskPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; checkIn?: string; checkOut?: string; guests?: string }>;
}) {
  const { city = "", checkIn = "", checkOut = "", guests = "2" } = await searchParams;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customer = await getBookingCustomer(supabase, membership.agency.id);
  if (!customer) redirect("/agent/book?service=hotels");

  // Dates are carried to the room step rather than into the search: blending
  // live supplier offers here would list rooms this desk can't yet book.
  const hotels = await searchHotels({ city: city || undefined });
  const stay = new URLSearchParams(
    Object.entries({ checkIn, checkOut, guests }).filter(([, value]) => value)
  ).toString();

  return (
    <div className="space-y-6">
      <PageHeader title="Hotels" back={{ href: "/agent/book", label: "Services" }} />

      <Card>
        <CardContent>
          <form
            role="search"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))_auto] xl:items-end"
          >
            <Field className="sm:col-span-2 xl:col-span-1">
              <FieldLabel htmlFor="city">City</FieldLabel>
              <Input id="city" name="city" defaultValue={city} placeholder="Mogadishu" />
            </Field>
            <Field>
              <FieldLabel htmlFor="checkIn">Check-in</FieldLabel>
              <Input id="checkIn" name="checkIn" type="date" defaultValue={checkIn} />
            </Field>
            <Field>
              <FieldLabel htmlFor="checkOut">Check-out</FieldLabel>
              <Input id="checkOut" name="checkOut" type="date" defaultValue={checkOut} min={checkIn || undefined} />
            </Field>
            <Field>
              <FieldLabel htmlFor="guests">Guests</FieldLabel>
              <Input id="guests" name="guests" type="number" required min={1} max={40} defaultValue={guests || "2"} />
            </Field>
            <Button type="submit" className="sm:col-span-2 xl:col-span-1">
              <Search data-icon="inline-start" aria-hidden="true" /> Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="hotel-results-title" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 id="hotel-results-title" className="font-heading text-sm font-semibold">Properties</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{hotels.length} result{hotels.length === 1 ? "" : "s"}</span>
        </div>
        {hotels.length === 0 ? (
          <Card><Empty><EmptyMedia variant="icon"><Hotel /></EmptyMedia><EmptyTitle>{city ? `No hotels match “${city}”` : "No hotels"}</EmptyTitle></Empty></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {hotels.map((hotel) => {
              const href = `/agent/book/hotels/${hotel.slug}${stay ? `?${stay}` : ""}`;
              return (
                <article key={hotel.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <Link href={href} tabIndex={-1} aria-hidden="true" className="relative block h-40 overflow-hidden bg-secondary">
                    {hotel.image ? <Image src={hotel.image} alt="" fill unoptimized className="object-cover transition-transform duration-300 hover:scale-105 motion-reduce:transform-none" /> : <span className="flex h-full items-center justify-center text-muted-foreground"><Hotel className="size-10" strokeWidth={1} /></span>}
                    {hotel.star_rating ? <span className="absolute top-3 right-3 flex items-center gap-1 rounded-md bg-card px-2 py-1 text-xs font-semibold"><Star className="size-3 fill-brand-gold text-brand-gold" aria-hidden="true" />{hotel.star_rating}<span className="sr-only">stars</span></span> : null}
                  </Link>
                  <div className="p-4">
                    <h3 className="truncate font-heading text-sm font-semibold"><Link href={href} className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">{hotel.name}</Link></h3>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5" aria-hidden="true" />{hotel.city}</div>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
                      <dl><dt className="text-[10px] text-muted-foreground">From / night</dt><dd className="mt-1 font-heading text-base font-semibold tabular-nums">{hotel.minPrice !== null && hotel.minPrice > 0 ? <AgentMoney value={money(Number(hotel.minPrice), hotel.currency)} /> : "On request"}</dd></dl>
                      <Button size="sm" variant="outline" render={<Link href={href} />}>Rooms & rates<ArrowRight className="size-3.5" aria-hidden="true" /></Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
