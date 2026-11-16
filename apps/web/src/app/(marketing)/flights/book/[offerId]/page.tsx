import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, PlaneTakeoff } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getServerTrpc } from "@/lib/trpc/server";
import { viewerAgencyId } from "@/modules/agencies/components/agency-booking-slot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { FlightOfferCard } from "@/modules/flights/components/flight-offer-card";
import { FlightBookingForm } from "@/modules/flights/components/flight-booking-form";

export const metadata: Metadata = { title: "Book your flight" };

export default async function BookFlightPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const profile = await requireUser(`/flights/book/${offerId}`);
  // Agents book from the desk, where the fare is charged to the agency wallet.
  if (await viewerAgencyId()) redirect(`/agent/book/flights/${offerId}`);

  const trpc = await getServerTrpc();
  const selected = /^[0-9a-f-]{36}$/i.test(offerId) ? await trpc.flights.offer.query({ id: offerId }).catch(() => null) : null;

  if (!selected) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Card>
          <CardContent>
            <Empty>
              <EmptyMedia variant="icon">
                <PlaneTakeoff />
              </EmptyMedia>
              <EmptyTitle>This fare is no longer available</EmptyTitle>
              <Button render={<Link href="/flights" />}>Search flights</Button>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { offer, adults, search } = selected;
  const backHref = `/flights?${new URLSearchParams({
    origin: search.origin,
    destination: search.destination,
    depart_date: search.departDate,
    ...(search.returnDate ? { return_date: search.returnDate, trip_type: "round_trip" } : { trip_type: "one_way" }),
    adults: String(search.adults),
    cabin: search.cabinClass,
  })}`;
  const [firstName, ...rest] = (profile.full_name ?? "").trim().split(/\s+/);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to results
      </Link>
      <h1 className="font-heading text-2xl font-bold sm:text-3xl">Book your flight</h1>

      <FlightOfferCard offer={offer} />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Passenger details</CardTitle>
        </CardHeader>
        <CardContent>
          <FlightBookingForm
            offerId={offer.id}
            passengerCount={adults}
            passengers={[{ firstName: firstName || null, lastName: rest.join(" ") || null }]}
            contactEmail={profile.email}
            contactPhone={profile.phone}
            submitLabel="Continue to payment"
          />
        </CardContent>
      </Card>
    </div>
  );
}
