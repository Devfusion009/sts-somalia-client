import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, Stamp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { countryFlag, countryName } from "@/lib/countries";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMyVisaApplications } from "@/modules/visa/queries";
import { visaCustomerProgress, visaNextAction, type NextAction } from "@/modules/visa/progress";
import { VisaStatusBadge, fmtMoney } from "@/modules/visa/components/visa-shared";
import type { VisaStage } from "@/modules/visa/workflow";

export const metadata: Metadata = { title: "Visa Applications" };

function nextLine(action: NextAction): string | null {
  switch (action.kind) {
    case "pay":
      return `Complete payment${action.amount ? ` · ${action.amount}` : ""}`;
    case "upload":
      return action.items.length === 1 ? `Upload ${action.items[0].label}` : `Upload ${action.items.length} documents`;
    case "attend":
      return `Appointment ${format(new Date(action.appointment.scheduled_at), "dd MMM")}`;
    case "handover":
      return "Hand in your passport";
    case "collect":
      return "Collect your passport";
    case "download":
      return "Download your visa";
    case "none":
      return null;
  }
}

export default async function AccountVisaPage() {
  await requireUser();
  const applications = await getMyVisaApplications();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Visa applications</h1>
        <Button render={<Link href="/visa" />} className="gap-1.5">
          New application <ArrowRight className="size-4" />
        </Button>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <Stamp className="size-5" />
            </span>
            <p className="font-medium">No visa applications yet</p>
            <Button render={<Link href="/visa" />} className="mt-1">
              Browse visa services
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const draft = app.status === "draft";
            const order = app.order_items[0]?.order ?? null;
            const input = {
              status: app.status as VisaStage,
              workflow: app.workflow,
              orderStatus: order?.status ?? null,
              orderId: order?.id ?? null,
              orderTotal: order ? fmtMoney(order.total, order.currency) : null,
              documents: app.documents,
              requests: app.document_requests,
              appointments: app.appointments,
              passports: app.passports,
              decisionOutcome: null,
            };
            const progress = draft ? null : visaCustomerProgress(input);
            const action = draft ? null : nextLine(visaNextAction(input, (t) => t.replace(/^request:/, "").replace(/_/g, " ")));
            return (
              <Link key={app.id} href={draft ? `/visa/apply/${app.id}` : `/account/visa/${app.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-wrap items-center gap-4 p-5">
                    <span className="text-3xl leading-none" aria-hidden>
                      {app.visa_type ? countryFlag(app.visa_type.destination_country_code) : "🌍"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-sm font-bold">
                        {app.visa_type
                          ? `${countryName(app.visa_type.destination_country_code)} — ${app.visa_type.name}`
                          : "Visa application"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-mono">{app.application_ref}</span> ·{" "}
                        {format(new Date(app.submitted_at ?? app.created_at), "d MMM yyyy")}
                        {progress ? ` · ${progress.stepLabel}` : ""}
                      </p>
                      {action ? <p className="mt-1 text-sm font-medium text-primary">{action}</p> : null}
                    </div>
                    <span className="font-semibold tabular-nums">{fmtMoney(app.price, app.currency)}</span>
                    <VisaStatusBadge status={app.status} />
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
