import Link from "next/link";
import { redirect } from "next/navigation";
import { PlaneTakeoff } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getServerTrpc } from "@/lib/trpc/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { AgentMoney } from "@/components/portal/agent-money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { money } from "@/lib/money";
import { FlightOfferCard } from "@/modules/flights/components/flight-offer-card";
import { FlightBookingForm } from "@/modules/flights/components/flight-booking-form";

export const metadata = { title: "Book flight" };

export default async function AgentBookFlightPage({ params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customers = await getBookingCustomers(supabase, membership.agency.id);
  if (customers.length === 0) redirect("/agent/book?service=flights");

  const trpc = await getServerTrpc();
  const selected = /^[0-9a-f-]{36}$/i.test(offerId) ? await trpc.flights.offer.query({ id: offerId }).catch(() => null) : null;

  if (!selected) {
    return (
      <div className="space-y-6">
        <PageHeader title="Book flight" back={{ href: "/agent/book/flights", label: "Flights" }} />
        <Card>
          <CardContent>
            <Empty>
              <EmptyMedia variant="icon">
                <PlaneTakeoff />
              </EmptyMedia>
              <EmptyTitle>This fare is no longer available</EmptyTitle>
              <Button render={<Link href="/agent/book/flights" />}>Search again</Button>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { offer, adults } = selected;
  const lead = customers[0];
  const available = Number(membership.agency.credit_balance ?? 0) + Number(membership.agency.credit_limit ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Book flight"
        back={{ href: "/agent/book/flights", label: "Flights" }}
        meta={customers.length > 1 ? `${customers.length} customers` : lead.full_name}
      />

      <FlightOfferCard offer={offer} />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Passengers</CardTitle>
        </CardHeader>
        <CardContent>
          <FlightBookingForm
            offerId={offer.id}
            passengerCount={adults}
            passengers={customers.slice(0, adults).map((c) => ({
              firstName: [c.first_name, c.middle_name].filter(Boolean).join(" ") || c.full_name.split(/\s+/)[0],
              lastName: c.last_name ?? c.full_name.split(/\s+/).slice(1).join(" "),
              gender: c.gender,
              dateOfBirth: c.date_of_birth,
              nationality: c.nationality,
              passportNumber: c.passport_number,
              passportExpiry: c.passport_expiry_date,
              passportCountry: c.passport_issuing_country,
            }))}
            contactEmail={lead.email ?? membership.agency.contact_email}
            contactPhone={lead.phone ?? membership.agency.contact_phone}
            desk
            agencyCustomerId={lead.id}
            walletOption={
              <span>
                Pay from wallet · <AgentMoney value={money(available, "USD")} /> available
              </span>
            }
            submitLabel="Book flight"
          />
        </CardContent>
      </Card>
    </div>
  );
}
