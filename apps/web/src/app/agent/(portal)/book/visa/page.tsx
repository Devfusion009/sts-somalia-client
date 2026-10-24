import { redirect } from "next/navigation";
import { Stamp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMyAgency } from "@/modules/agencies/queries";
import { getBookingCustomer } from "@/modules/agencies/booking-context";
import { getVisaTypes } from "@/modules/visa/queries";
import { countryFlag, countryName } from "@/lib/countries";
import { fmtMoney, processingText } from "@/modules/visa/components/visa-shared";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { StartApplicationButton } from "./start-application-button";

export const metadata = { title: "Visa" };

export default async function AgentVisaDeskPage() {
  const profile = await requireUser();
  const membership = await getMyAgency(profile.id);
  if (!membership) return null;

  const supabase = await createClient();
  const customer = await getBookingCustomer(supabase, membership.agency.id);
  if (!customer) redirect("/agent/book");

  const visaTypes = await getVisaTypes();

  return (
    <div className="space-y-6">
      <PageHeader title="Visa" back={{ href: "/agent/book", label: "Services" }} />

      {visaTypes.length === 0 ? (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <Stamp />
            </EmptyMedia>
            <EmptyTitle>No visa products</EmptyTitle>
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visaTypes.map((visa) => (
            <Card key={visa.id}>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="text-2xl leading-none" aria-hidden="true">
                    {countryFlag(visa.destination_country_code)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{visa.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {countryName(visa.destination_country_code)}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Processing</dt>
                    <dd className="truncate tabular-nums">{processingText(visa)}</dd>
                  </div>
                  <div className="text-right">
                    <dt className="text-xs text-muted-foreground">Price</dt>
                    <dd className="font-heading font-semibold tabular-nums">
                      {fmtMoney(visa.price, visa.currency)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-auto border-t border-border pt-3">
                  <StartApplicationButton visaTypeId={visa.id} agencyCustomerId={customer.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
