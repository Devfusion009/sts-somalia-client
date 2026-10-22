import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { createBatchBooking } from "@/modules/agencies/batch-booking-actions";
import { bookableDepartures, getPackageBySlug } from "@/modules/umrah/queries";
import { BookingForm } from "@/app/(marketing)/umrah/[slug]/booking-form";
import { Card, CardContent } from "@/components/ui/card";

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

  return (
    <div className="space-y-4">
      <Link
        href="/agent/book/umrah"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Umrah
      </Link>

      <div>
        <h1 className="font-heading text-2xl font-bold">{pkg.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[
            `${pkg.duration_days} nights`,
            pkg.origin_iata && pkg.destination_iata
              ? `${pkg.origin_iata} → ${pkg.destination_iata}`
              : null,
            `${pkg.currency} ${Number(pkg.base_price).toFixed(0)} per pilgrim`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

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
