import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { createBatchBooking } from "@/modules/agencies/batch-booking-actions";
import { bookableDepartures, getPackageBySlug } from "@/modules/umrah/queries";
import { BookingForm } from "@/app/(marketing)/umrah/[slug]/booking-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatRail, StatRailItem } from "@/components/dashboard/stat-rail";
import { money } from "@/lib/money";

export default async function AgentUmrahBookingPage({
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

  const pkg = await getPackageBySlug(slug);
  if (!pkg) notFound();

  const upcomingDepartures = bookableDepartures(pkg.umrah_package_departures ?? []);

  const seatsOnSale = upcomingDepartures.reduce(
    (sum, d) => sum + Math.max(d.total_seats - d.booked_seats - d.offline_seats, 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/agent/book/umrah", label: "Umrah" }}
        title={pkg.name}
        meta={
          pkg.origin_iata && pkg.destination_iata
            ? `${pkg.origin_iata} → ${pkg.destination_iata}`
            : undefined
        }
      />

      <StatRail>
        <StatRailItem label="Nights" value={pkg.duration_days} />
        <StatRailItem label="From / pilgrim" value={money(Number(pkg.base_price), pkg.currency)} />
        <StatRailItem label="Departures" value={upcomingDepartures.length} />
        <StatRailItem label="Seats left" value={seatsOnSale} tone={seatsOnSale === 0 ? "warn" : undefined} />
      </StatRail>

      <Card>
        <CardContent>
          <BookingForm
            packageSlug={pkg.slug}
            currency={pkg.currency}
            basePrice={Number(pkg.base_price)}
            departures={upcomingDepartures}
            pricing={pkg.umrah_package_pricing}
            action={isGroup ? createBatchBooking : undefined}
            bookedForSlot={
              <>
                <input type="hidden" name="agencyCustomerId" value={customers[0].id} />
                <input type="hidden" name="vertical" value="umrah" />
                <input type="hidden" name="desk" value="1" />
              </>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
