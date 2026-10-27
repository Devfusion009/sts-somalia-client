import Link from "next/link";
import { countryFlag, countryName } from "@/lib/countries";
import { Badge, statusBadgeVariant, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VISA_STATUS_LABELS } from "@/modules/visa/schemas";
import type { Database } from "@/lib/types/database.types";

type VisaTypeRow = Database["public"]["Tables"]["visa_types"]["Row"];

export function processingText(visa: Pick<VisaTypeRow, "processing_days_min" | "processing_days_max">) {
  if (!visa.processing_days_min) return "Varies";
  const max =
    visa.processing_days_max && visa.processing_days_max !== visa.processing_days_min
      ? ` – ${visa.processing_days_max}`
      : "";
  return `${visa.processing_days_min}${max} working days`;
}

export function fmtMoney(amount: number | string, currency: string) {
  const value = Number(amount);
  return `${currency} ${value.toLocaleString("en-US", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Always two decimals, for fee breakdowns where lines must add up visibly. */
export function fmtMoneyExact(amount: number | string, currency: string) {
  return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_BADGE_VARIANTS: Partial<Record<string, BadgeVariant>> = {
  additional_info_required: "warning",
  ready_for_processing: "info",
  processing: "info",
  cancelled: "neutral",
};

export function VisaStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusBadgeVariant(status, STATUS_BADGE_VARIANTS)} className={className}>
      {VISA_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const DOCUMENT_BADGES: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Awaiting review", variant: "warning" },
  accepted: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
  missing: { label: "Missing", variant: "neutral" },
  replaced: { label: "Replaced", variant: "neutral" },
};

export function DocumentStatusBadge({ status, className }: { status: string; className?: string }) {
  const badge = DOCUMENT_BADGES[status] ?? DOCUMENT_BADGES.pending;
  return (
    <Badge variant={badge.variant} className={className}>
      {badge.label}
    </Badge>
  );
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
  const defaultFacts = [
    { label: "Processing time", value: processingText(visaType), icon: "clock" as const },
    ...(visaType.validity_days
      ? [{ label: "Validity", value: `${visaType.validity_days} days`, icon: "calendar" as const }]
      : []),
    ...(visaType.stay_days
      ? [{ label: "Stay period", value: `${visaType.stay_days} days`, icon: "range" as const }]
      : []),
  ];

  // `icon` stays on the facts type for callers; the banner renders label/value only.
  const shownFacts = facts ?? defaultFacts;

  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-xs">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-4xl leading-none" aria-hidden>
            {countryFlag(visaType.destination_country_code)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-lg font-bold tracking-tight sm:text-xl">
              {countryName(visaType.destination_country_code)}
            </h1>
            <p className="truncate text-sm text-muted-foreground">{visaType.name}</p>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap items-end gap-x-8 gap-y-3 border-t border-border pt-4 lg:border-0 lg:pt-0">
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {shownFacts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-xs text-muted-foreground">{fact.label}</dt>
                <dd className="text-sm font-semibold tabular-nums">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <div className="ml-auto flex items-center gap-4">
            {right ?? (
              <>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Price from</p>
                  <p className="font-heading text-xl font-bold text-primary tabular-nums">
                    {fmtMoney(visaType.price, visaType.currency)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  render={<Link href={`/visa/${visaType.id}`} />}
                  className="hidden sm:inline-flex"
                >
                  View details
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
