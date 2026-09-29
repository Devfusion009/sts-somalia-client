import Link from "next/link";
import { Clock3, CalendarCheck2, CalendarRange, Printer } from "lucide-react";
import { countryFlag, countryName } from "@/lib/countries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VISA_STATUS_LABELS } from "@/modules/visa/schemas";
import type { Database } from "@/lib/types/database.types";

type VisaTypeRow = Database["public"]["Tables"]["visa_types"]["Row"];

export function processingText(visa: Pick<VisaTypeRow, "processing_days_min" | "processing_days_max">) {
  if (!visa.processing_days_min) return "Varies";
  const max =
    visa.processing_days_max && visa.processing_days_max !== visa.processing_days_min
      ? ` – ${visa.processing_days_max}`
      : "";
  return `${visa.processing_days_min}${max} Working Days`;
}

export function fmtMoney(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toFixed(0)}`;
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-chart-3/10 text-chart-3",
  in_review: "bg-brand-gold/15 text-brand-gold",
  additional_info_required: "bg-brand-accent/10 text-brand-accent",
  ready_for_processing: "bg-chart-2/10 text-chart-2",
  processing: "bg-chart-4/10 text-chart-4",
  approved: "bg-primary/10 text-primary",
  issued: "bg-primary/10 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

export function VisaStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      className={cn(
        "border-transparent font-semibold hover:bg-current/10",
        STATUS_BADGE_STYLES[status] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {VISA_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const DOCUMENT_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: "Awaiting review", className: "bg-brand-gold/15 text-brand-gold" },
  accepted: { label: "Verified", className: "bg-primary/10 text-primary" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
  missing: { label: "Missing", className: "bg-muted text-muted-foreground" },
  replaced: { label: "Replaced", className: "bg-muted text-muted-foreground" },
};

export function DocumentStatusBadge({ status, className }: { status: string; className?: string }) {
  const badge = DOCUMENT_BADGES[status] ?? DOCUMENT_BADGES.pending;
  return <Badge className={cn("border-transparent font-medium", badge.className, className)}>{badge.label}</Badge>;
}

/**
 * The wide banner at the top of the apply/tracking pages: flag, visa name,
 * and the key facts strip (processing / validity / stay / price).
 */
export function VisaTypeBanner({
  visaType,
  right,
  facts,
}: {
  visaType: VisaTypeRow;
  right?: React.ReactNode;
  facts?: Array<{ label: string; value: string; icon?: "clock" | "calendar" | "range" | "print" }>;
}) {
  const factIcons = {
    clock: Clock3,
    calendar: CalendarCheck2,
    range: CalendarRange,
    print: Printer,
  } as const;

  const defaultFacts = [
    { label: "Processing Time", value: processingText(visaType), icon: "clock" as const },
    ...(visaType.validity_days
      ? [{ label: "Validity", value: `${visaType.validity_days} Days`, icon: "calendar" as const }]
      : []),
    ...(visaType.stay_days
      ? [{ label: "Stay Period", value: `${visaType.stay_days} Days`, icon: "range" as const }]
      : []),
  ];

  const shownFacts = facts ?? defaultFacts;

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-4xl leading-none" aria-hidden>
            {countryFlag(visaType.destination_country_code)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-lg font-bold sm:text-xl">
              {countryName(visaType.destination_country_code)}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{visaType.name}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-3">
          {shownFacts.map((fact) => {
            const Icon = fact.icon ? factIcons[fact.icon] : Clock3;
            return (
              <div key={fact.label} className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-primary">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">{fact.label}</p>
                  <p className="text-sm font-semibold">{fact.value}</p>
                </div>
              </div>
            );
          })}
          <div className="ml-auto flex items-center gap-4">
            {right ?? (
              <>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Price From</p>
                  <p className="font-heading text-xl font-bold text-primary">
                    {fmtMoney(visaType.price, visaType.currency)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  render={<Link href={`/visa/${visaType.id}`} />}
                  className="hidden sm:inline-flex"
                >
                  View Details
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SecureDataNote() {
  return (
    <div className="rounded-xl border border-primary/20 bg-secondary/60 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
          <path
            d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Your data is secure and encrypted
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        We use 256-bit SSL encryption to protect your information.
      </p>
    </div>
  );
}
