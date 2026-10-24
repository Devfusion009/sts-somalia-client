import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { createBatchBooking } from "@/modules/agencies/batch-booking-actions";
import { HallBookingForm } from "@/modules/events/components/booking-form";
import { priceUnitLabel } from "@/modules/events/components/amenities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/money";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";
import { venueCapacity } from "@sts/shared-types";

export default async function AgentVenueBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customers = await getBookingCustomers(supabase, membership.agency.id);
  if (customers.length === 0) redirect("/agent/book");
  const isGroup = customers.length > 1;

  const trpc = await getServerTrpc();
  let venue;
  try {
    venue = await trpc.events.venueBySlug.query({ slug });
  } catch {
    return (
      <div className="space-y-6">
        <PageHeader title="Venue" back={{ href: "/agent/book/events", label: "Event halls" }} />
        <UnavailableNotice label="Venue" />
      </div>
    );
  }
  if (!venue) notFound();

  const eventTypes = Array.isArray(venue.event_types) ? (venue.event_types as string[]) : [];

  const capacity = venueCapacity(venue);
  const price = Number(venue.base_price);

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/agent/book/events", label: "Event halls" }}
        title={venue.name}
        meta={[venue.city, capacity ? `Up to ${capacity} guests` : null].filter(Boolean).join(" · ")}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardContent>
            <HallBookingForm
              venueId={venue.id}
              currency={venue.currency}
              basePrice={price}
              priceUnit={venue.price_unit}
              eventTypes={eventTypes}
              maxGuests={capacity}
              action={isGroup ? createBatchBooking : undefined}
              bookedForSlot={
                <>
                  <input type="hidden" name="agencyCustomerId" value={customers[0].id} />
                  <input type="hidden" name="vertical" value="hall" />
                  <input type="hidden" name="desk" value="1" />
                </>
              }
            />
          </CardContent>
        </Card>

        <Card className="lg:sticky lg:top-24 max-lg:order-first">
          <CardHeader>
            <CardTitle>Venue</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-sm">
              <div className="flex items-baseline justify-between gap-3 pb-2">
                <dt className="text-muted-foreground">Rate</dt>
                <dd className="text-right font-medium tabular-nums">
                  {price > 0 ? money(price, venue.currency) : "On request"}
                </dd>
              </div>
              {price > 0 ? (
                <div className="flex items-baseline justify-between gap-3 py-2">
                  <dt className="text-muted-foreground">Charged</dt>
                  <dd className="text-right capitalize">{priceUnitLabel(venue.price_unit)}</dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Capacity</dt>
                <dd className="text-right tabular-nums">{capacity ?? "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 pt-2">
                <dt className="text-muted-foreground">City</dt>
                <dd className="text-right">{venue.city ?? "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
