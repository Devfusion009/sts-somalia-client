import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { createBatchBooking } from "@/modules/agencies/batch-booking-actions";
import { HallBookingForm } from "@/modules/events/components/booking-form";
import { Card, CardContent } from "@/components/ui/card";
import { UnavailableNotice } from "@/components/portal/unavailable-notice";

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
    return <UnavailableNotice label="Venue" />;
  }
  if (!venue) notFound();

  const eventTypes = Array.isArray(venue.event_types) ? (venue.event_types as string[]) : [];

  return (
    <div className="space-y-4">
      <Link
        href="/agent/book/events"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Event halls
      </Link>

      <div>
        <h1 className="font-heading text-2xl font-bold">{venue.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[
            venue.city,
            venue.capacity_standing ?? venue.capacity_seated
              ? `up to ${venue.capacity_standing ?? venue.capacity_seated} guests`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <Card>
        <CardContent>
          <HallBookingForm
            venueId={venue.id}
            currency={venue.currency}
            basePrice={Number(venue.base_price)}
            priceUnit={venue.price_unit}
            eventTypes={eventTypes}
            maxGuests={venue.capacity_standing ?? venue.capacity_seated}
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
    </div>
  );
}
