import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { FilterChips } from "@/components/dashboard/filter-chips";
import { countryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { getUpcomingVisaAppointments } from "@/modules/visa/case-queries";
import { requireVisaPermission } from "@/modules/visa/staff-auth";
import { visaStaffCan } from "@/modules/visa/permissions";
import { formatInZone } from "@/modules/visa/time";
import { APPOINTMENT_TYPE_LABELS, isDueWithin, isPast } from "@/modules/visa/workflow";
import { AppointmentOutcome } from "../[id]/lifecycle-forms";

export const metadata: Metadata = { title: "Visa Appointments" };

type Appt = Awaited<ReturnType<typeof getUpcomingVisaAppointments>>[number];

function dayKey(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

function Row({ a, canManage }: { a: Appt; canManage: boolean }) {
  const tz = a.centre?.timezone ?? "Africa/Mogadishu";
  const traveler = (a.application?.traveler_details ?? {}) as Record<string, string>;
  const overdue = isPast(a.scheduled_at);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <time className={cn("w-14 shrink-0 font-heading text-base font-semibold tabular-nums", overdue && "text-destructive")}>
        {formatInZone(a.scheduled_at, tz).split(", ").at(-1)}
      </time>
      <div className="min-w-0 flex-1">
        <Link
          href={`/admin/visa/${a.application_id}?tab=appointments`}
          className="rounded-sm font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {traveler.full_name ?? "Applicant"}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{a.application?.application_ref}</span> ·{" "}
          <span aria-hidden>{countryFlag(a.application?.visa_type?.destination_country_code ?? "")}</span>{" "}
          {a.application?.visa_type?.name}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{APPOINTMENT_TYPE_LABELS[a.appointment_type]}</Badge>
        {a.biometrics_required ? <Badge variant="outline">Biometrics</Badge> : null}
      </div>
      <p className="w-full truncate text-sm text-muted-foreground sm:w-48">
        {a.centre?.name}
        {a.confirmation_number ? ` · ${a.confirmation_number}` : ""}
      </p>
      {canManage ? (
        <AppointmentOutcome
          applicationId={a.application_id}
          appointmentId={a.id}
          biometricsRequired={a.biometrics_required}
          due={isDueWithin(a.scheduled_at, 12)}
        />
      ) : null}
    </li>
  );
}

export default async function VisaAppointmentsPage({ searchParams }: { searchParams: Promise<{ centre?: string }> }) {
  const profile = await requireVisaPermission("visa.applications.read");
  const { centre } = await searchParams;
  const all = await getUpcomingVisaAppointments();
  const canManage = visaStaffCan(profile, "visa.appointments.manage");

  const centres = [...new Map(all.filter((a) => a.centre).map((a) => [a.centre!.id, a.centre!])).values()];
  const list = centre ? all.filter((a) => a.centre_id === centre) : all;
  const overdue = list.filter((a) => isPast(a.scheduled_at));
  const upcoming = list.filter((a) => !isPast(a.scheduled_at));

  const days = new Map<string, Appt[]>();
  for (const a of upcoming) {
    const key = dayKey(a.scheduled_at, a.centre?.timezone ?? "Africa/Mogadishu");
    days.set(key, [...(days.get(key) ?? []), a]);
  }

  const chips = [{ key: "", label: "All centres", href: "/admin/visa/appointments", count: all.length }].concat(
    centres.map((c) => ({
      key: c.id,
      label: c.name,
      href: `/admin/visa/appointments?centre=${c.id}`,
      count: all.filter((a) => a.centre_id === c.id).length,
    }))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visa appointments"
        status={
          <Badge variant="neutral" className="tabular-nums">
            {list.length}
          </Badge>
        }
      />

      {centres.length > 1 ? <FilterChips items={chips} active={centre ?? ""} label="Filter by centre" /> : null}

      {overdue.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold">Outcome not recorded</h2>
            <Badge variant="destructive" className="tabular-nums">
              {overdue.length}
            </Badge>
          </div>
          <Card className="py-0">
            <CardContent className="px-4 sm:px-6">
              <ul className="divide-y divide-border">
                {overdue.map((a) => (
                  <Row key={a.id} a={a} canManage={canManage} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {days.size === 0 && overdue.length === 0 ? (
        <Card>
          <Empty>
            <EmptyMedia variant="icon">
              <CalendarCheck2 />
            </EmptyMedia>
            <EmptyTitle>No upcoming appointments</EmptyTitle>
          </Empty>
        </Card>
      ) : null}

      {[...days.entries()].map(([key, items]) => (
        <section key={key} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold">{dayLabel(key)}</h2>
            <Badge variant="neutral" className="tabular-nums">
              {items.length}
            </Badge>
          </div>
          <Card className="py-0">
            <CardContent className="px-4 sm:px-6">
              <ul className="divide-y divide-border">
                {items.map((a) => (
                  <Row key={a.id} a={a} canManage={canManage} />
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ))}
    </div>
  );
}
