import {
  StickyNote,
  Users,
  MapPin,
  CalendarCheck2,
  CalendarRange,
  Clock3,
  Headset,
  UsersRound,
} from "lucide-react";
import { countryName } from "@/lib/countries";
import { Button } from "@/components/ui/button";
import { fmtMoney, processingText } from "./visa-shared";
import type { WizardApplication } from "@/modules/visa/queries";

const APPLICANT_TYPE_LABELS: Record<string, string> = {
  single: "Single Applicant",
  family: "Family Application",
  group: "Group Application",
};

/** Sticky right-rail summary shown throughout the wizard and tracking pages. */
export function ApplicationSummary({
  application,
  priceLabel = "Price",
}: {
  application: Pick<WizardApplication, "applicant_type" | "members" | "currency" | "price"> & {
    visa_type: WizardApplication["visa_type"];
  };
  priceLabel?: string;
}) {
  const visaType = application.visa_type;
  if (!visaType) return null;

  const memberCount =
    application.applicant_type === "single" ? 1 : Math.max(application.members.length, 1);
  const total = Number(visaType.price) * memberCount;

  const rows = [
    { icon: StickyNote, label: "Visa Type", value: visaType.name },
    {
      icon: Users,
      label: "Applicant Type",
      value: APPLICANT_TYPE_LABELS[application.applicant_type] ?? application.applicant_type,
    },
    ...(application.applicant_type !== "single"
      ? [{ icon: UsersRound, label: "Total Members", value: `${memberCount} Members` }]
      : []),
    {
      icon: MapPin,
      label: "Destination",
      value: countryName(visaType.destination_country_code),
    },
    ...(visaType.validity_days
      ? [{ icon: CalendarCheck2, label: "Validity", value: `${visaType.validity_days} Days` }]
      : []),
    ...(visaType.stay_days
      ? [{ icon: CalendarRange, label: "Stay Period", value: `${visaType.stay_days} Days` }]
      : []),
    { icon: Clock3, label: "Processing Time", value: processingText(visaType) },
  ];

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <h2 className="font-heading text-base font-bold">Application Summary</h2>
        <dl className="mt-4 space-y-3.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <row.icon className="size-3.5" />
              </span>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-semibold">{row.value}</dd>
              </div>
            </div>
          ))}
        </dl>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">{priceLabel}</span>
          <span className="font-heading text-xl font-bold text-primary">
            {fmtMoney(total, visaType.currency)}
          </span>
        </div>
        {memberCount > 1 ? (
          <p className="mt-1 text-right text-xs text-muted-foreground">
            {fmtMoney(visaType.price, visaType.currency)} × {memberCount} applicants
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">All fees are non-refundable.</p>
      </div>

      <div className="rounded-2xl border border-border bg-secondary/50 p-5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Headset className="size-4 text-primary" /> Need Help?
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          If you have any questions about this application, our support team is here to help.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          render={<a href="tel:+252611444420" />}
        >
          Contact Support
        </Button>
      </div>
    </aside>
  );
}
