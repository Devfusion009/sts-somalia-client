import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { VisaStage } from "@/modules/visa/workflow";
import { VISA_STAGE_LABELS } from "@/modules/visa/workflow";
import type { VisaCase } from "@/modules/visa/case-queries";

export const CASE_TABS = [
  "overview",
  "applicant",
  "documents",
  "appointments",
  "submission",
  "decision",
  "passport",
  "payment",
  "messages",
  "notes",
  "activity",
] as const;
export type CaseTab = (typeof CASE_TABS)[number];

export function isCaseTab(value: string | undefined): value is CaseTab {
  return !!value && (CASE_TABS as readonly string[]).includes(value);
}

export const STAGE_VARIANT: Record<VisaStage, BadgeVariant> = {
  draft: "neutral",
  submitted: "info",
  in_review: "warning",
  additional_info_required: "warning",
  ready_for_processing: "info",
  processing: "info",
  approved: "success",
  issued: "success",
  rejected: "destructive",
  cancelled: "neutral",
};

export function StageBadge({ stage, className }: { stage: VisaStage; className?: string }) {
  return (
    <Badge variant={STAGE_VARIANT[stage] ?? "neutral"} className={className}>
      {VISA_STAGE_LABELS[stage]}
    </Badge>
  );
}

/** One label/value cell of the case header strip (wraps; any number of facts). */
export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "danger" | "warn" }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-heading text-base font-semibold text-foreground tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "warn" && "text-[color-mix(in_oklch,var(--brand-gold),black_30%)] dark:text-brand-gold"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function DetailGrid({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className={cn("mt-0.5 text-sm break-words", value ? "font-medium" : "text-muted-foreground")}>
            {value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <h2 className="font-heading text-base font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function formatWhen(iso: string) {
  return format(new Date(iso), "d MMM yyyy, HH:mm");
}

export function formatDay(iso: string | null | undefined) {
  return iso ? format(new Date(iso), "d MMM yyyy") : "—";
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type CaseEvent = VisaCase["events"][number];

const ACTOR_LABELS: Record<string, string> = {
  customer: "Applicant",
  agent: "Agent",
  staff: "Staff",
  system: "System",
  partner: "Partner",
};

export function EventList({ events }: { events: CaseEvent[] }) {
  return (
    <ol className="divide-y divide-border">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2.5 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium break-words">{event.summary}</p>
            <p className="text-xs text-muted-foreground">
              {event.actor_name ?? ACTOR_LABELS[event.actor_kind] ?? event.actor_kind}
              {event.actor_name ? ` · ${ACTOR_LABELS[event.actor_kind] ?? event.actor_kind}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {event.customer_visible ? (
              <Badge variant="outline">Applicant sees</Badge>
            ) : null}
            <time className="text-xs text-muted-foreground tabular-nums" dateTime={event.created_at}>
              {formatWhen(event.created_at)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
