import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomers } from "@/modules/agencies/booking-context";
import { Card, CardContent } from "@/components/ui/card";
import { FlightQuoteForm } from "./flight-quote-form";

export default async function AgentFlightDeskPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customers = await getBookingCustomers(supabase, membership.agency.id);
  if (customers.length === 0) redirect("/agent/book");
  const customer = customers[0];

  return (
    <div className="space-y-4">
      <Link
        href="/agent/book"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Services
      </Link>

      <h1 className="font-heading text-2xl font-bold">Flights</h1>

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
