import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Stamp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getMyVisaApplications } from "@/modules/visa/queries";
import { countryFlag, countryName } from "@/lib/countries";
import { VisaStatusBadge, fmtMoney } from "@/modules/visa/components/visa-shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export const metadata: Metadata = { title: "Visa Applications" };

export default async function AccountVisaPage() {
  await requireUser();
  const applications = await getMyVisaApplications();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Visa Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track every application, upload requested documents, and download issued visas.
          </p>
        </div>
        <Button render={<Link href="/visa" />} className="gap-1.5">
          New Application <ArrowRight className="size-4" />
        </Button>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Stamp className="size-5" />
            </span>
            <p className="font-medium">No visa applications yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Start your first application — it only takes a few minutes and your progress is saved
              as you go.
            </p>
            <Button render={<Link href="/visa" />} className="mt-1">
              Browse visa services
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Link
              key={app.id}
              href={
                app.status === "draft" ? `/visa/apply/${app.id}` : `/account/visa/${app.id}`
              }
              className="block"
            >
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex flex-wrap items-center gap-4 p-5">
                  <span className="text-3xl leading-none">
                    {app.visa_type ? countryFlag(app.visa_type.destination_country_code) : "🌍"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-sm font-bold">
                      {app.visa_type
                        ? `${countryName(app.visa_type.destination_country_code)} — ${app.visa_type.name}`
                        : "Visa application"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {app.application_ref} · {app.applicant_type} ·{" "}
                      {format(new Date(app.created_at), "d MMM yyyy")}
                    </p>
                  </div>
                  <span className="font-semibold">{fmtMoney(app.price, app.currency)}</span>
                  <VisaStatusBadge status={app.status} />
                  <ArrowRight className="size-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
