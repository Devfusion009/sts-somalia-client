import Link from "next/link";
import { format } from "date-fns";
import { ArrowRight, CalendarClock, Download, FileUp, MapPin, PackageOpen, Stamp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { NextAction } from "@/modules/visa/progress";
import { formatInZone } from "@/modules/visa/time";
import { APPOINTMENT_TYPE_LABELS } from "@/modules/visa/workflow";

function Shell({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/25 sm:flex-row sm:items-center sm:p-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {children}
      </div>
      {action ? <div className="shrink-0 max-sm:[&>*]:w-full">{action}</div> : null}
    </section>
  );
}

/** The one thing the applicant should do now. Renders nothing when nothing is needed. */
export function NextActionCard({ action }: { action: NextAction }) {
  switch (action.kind) {
    case "pay":
      return (
        <Shell
          icon={Wallet}
          title="Complete your payment"
          action={
            <Button size="lg" render={<Link href={action.href} />}>
              Pay{action.amount ? ` ${action.amount}` : ""} <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          }
        />
      );
    case "upload":
      return (
        <Shell
          icon={FileUp}
          title={action.items.length === 1 ? "Upload 1 document" : `Upload ${action.items.length} documents`}
          action={
            <Button size="lg" render={<a href="#documents" />}>
              Upload <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </Button>
          }
        >
          <ul className="space-y-0.5 text-sm">
            {action.items.map((item, i) => (
              <li key={i}>
                <span className="font-medium">{item.label}</span>
                {item.reason ? <span className="text-muted-foreground"> — {item.reason}</span> : null}
                {item.due ? (
                  <span className="font-medium text-[color-mix(in_oklch,var(--brand-gold),black_30%)] tabular-nums dark:text-brand-gold">
                    {" "}
                    · by {format(new Date(item.due), "d MMM")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Shell>
      );
    case "attend": {
      const a = action.appointment;
      const tz = a.centre?.timezone ?? "Africa/Mogadishu";
      return (
        <Shell icon={CalendarClock} title={`${APPOINTMENT_TYPE_LABELS[a.appointment_type] ?? "Appointment"} · ${formatInZone(a.scheduled_at, tz)}`}>
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" />
            {a.centre?.name}, {a.centre?.address ?? a.centre?.city}
            {a.confirmation_number ? <span className="font-mono text-foreground"> · {a.confirmation_number}</span> : null}
          </p>
          {a.biometrics_required ? <Badge variant="warning">Bring passport · biometrics</Badge> : null}
        </Shell>
      );
    }
    case "handover":
      return <Shell icon={Stamp} title="Hand in your passport at the STS office" />;
    case "collect":
      return (
        <Shell icon={PackageOpen} title="Your passport is ready for collection">
          {action.hours ? <p className="text-sm text-muted-foreground">{action.hours}</p> : null}
        </Shell>
      );
    case "download":
      return (
        <Shell
          icon={Download}
          title="Your visa is ready"
          action={
            <Button
              size="lg"
              render={<a href={`/api/visa/documents/${action.documentId}`} target="_blank" rel="noopener noreferrer" />}
            >
              <Download data-icon="inline-start" aria-hidden="true" /> Download
            </Button>
          }
        />
      );
    case "none":
      return null;
  }
}
