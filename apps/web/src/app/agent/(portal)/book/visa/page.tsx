import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomer } from "@/modules/agencies/booking-context";
import { getVisaTypes } from "@/modules/visa/queries";
import { countryFlag, countryName } from "@/lib/countries";
import { fmtMoney, processingText } from "@/modules/visa/components/visa-shared";
import { Card, CardContent } from "@/components/ui/card";
import { StartApplicationButton } from "./start-application-button";

export default async function AgentVisaDeskPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customer = await getBookingCustomer(supabase, membership.agency.id);
  if (!customer) redirect("/agent/book");

  const visaTypes = await getVisaTypes();

  return (
    <div className="space-y-4">
      <Link
        href="/agent/book"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Services
      </Link>

      <div>
        <h1 className="font-heading text-2xl font-bold">Visa</h1>
        <p className="text-sm text-muted-foreground">For {customer.full_name}</p>
      </div>

      {visaTypes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No visa products published yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visaTypes.map((visa) => (
            <Card key={visa.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl leading-none" aria-hidden>
                    {countryFlag(visa.destination_country_code)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{visa.name}</p>
                    <p className="text-xs text-muted-foreground">{countryName(visa.destination_country_code)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{processingText(visa)}</span>
                  <span className="font-heading font-bold text-primary">{fmtMoney(visa.price, visa.currency)}</span>
                </div>
                <StartApplicationButton visaTypeId={visa.id} agencyCustomerId={customer.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
