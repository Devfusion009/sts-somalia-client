import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronRight, Globe, Plus, Stamp } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { countryFlag, countryName } from "@/lib/countries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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

  const newButton = (
    <Button render={<Link href="/visa" />}>
      <Plus data-icon="inline-start" aria-hidden="true" /> New application
    </Button>
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Visa applications"
        status={applications.length > 0 ? <Badge variant="secondary">{applications.length}</Badge> : null}
        actions={applications.length > 0 ? newButton : null}
      />

      {applications.length === 0 ? (
        <Card>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Stamp />
              </EmptyMedia>
              <EmptyTitle>No visa applications</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>{newButton}</EmptyContent>
          </Empty>
        </Card>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <ul className="divide-y divide-border">
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
                <li key={app.id}>
                  <Link
                    href={draft ? `/visa/apply/${app.id}` : `/account/visa/${app.id}`}
                    className="group flex items-center gap-3 px-4 py-4 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset sm:gap-4 sm:px-5"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xl leading-none" aria-hidden="true">
                      {app.visa_type ? (
                        countryFlag(app.visa_type.destination_country_code)
                      ) : (
                        <Globe className="size-4 text-muted-foreground" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {app.visa_type
                          ? `${countryName(app.visa_type.destination_country_code)} — ${app.visa_type.name}`
                          : "Visa application"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground tabular-nums">
                        <span className="font-mono">{app.application_ref}</span> ·{" "}
                        {format(new Date(app.submitted_at ?? app.created_at), "d MMM yyyy")}
                        {progress ? ` · ${progress.stepLabel}` : ""}
                      </p>
                      {action ? <p className="mt-1 text-sm font-medium text-primary">{action}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row-reverse sm:items-center sm:gap-4">
                      <VisaStatusBadge status={app.status} />
                      <span className="text-sm font-medium tabular-nums">{fmtMoney(app.price, app.currency)}</span>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
