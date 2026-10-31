import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { FlightQuoteForm } from "./flight-quote-form";

export const metadata = { title: "Flights" };

export default async function AgentFlightDeskPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customers = await getBookingCustomers(supabase, membership.agency.id);
  if (customers.length === 0) redirect("/agent/book?service=flights");
  const customer = customers[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Flight quote" back={{ href: "/agent/book", label: "Services" }} />

      <Card>
        <CardContent>
          <FlightQuoteForm
            agencyCustomerId={customer.id}
            customerName={
              customers.length > 1 ? `${customers.length} customers` : customer.full_name
            }
            defaultPhone={customer.phone ?? ""}
            isGroup={customers.length > 1}
          />
        </CardContent>
      </Card>
    </div>
  );
}
