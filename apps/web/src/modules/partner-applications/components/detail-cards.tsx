import { FileText, FileImage, File as FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { humanizeKey } from "@/lib/format-detail";
import {
  AUDIENCE_LOCATION_LABELS,
  PROPERTY_TYPE_LABELS,
  STAR_RATING_LABELS,
  AMENITY_LABELS,
  CANCELLATION_POLICY_LABELS,
  PAYOUT_FREQUENCY_LABELS,
} from "@/modules/partner-applications/config";
import type { ApplicationType } from "@/modules/admin/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export type Details = Record<string, unknown>;

/**
 * One heading idiom for every card on an application/partner detail page:
 * plain text, no icon chip. The repeated icon-in-a-title treatment this
 * replaced made each section look like an unrelated widget rather than part
 * of one record.
 */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <CardTitle className="text-base">{children}</CardTitle>;
}

function s(v: unknown): string {
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

/** snake_case -> "Snake Case", every word capitalized — matches the wizard's own OptionPicker label generation for values with no dedicated label map (business type, traffic source, event types). */
function titleCase(v: unknown): string {
  const str = String(v ?? "");
  if (!str) return "—";
  return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The 2-3 facts that identify this specific application at a glance — the
 * same fields BusinessDetailsCard renders in full, condensed for a page
 * header's meta line ("Hotel · 1 star · Kolkata" rather than a generic
 * "Hotel Partner application").
 */
export function headerFacts(kind: ApplicationType, d: Details): string[] {
  const facts: Array<string | null> =
    kind === "hotel_partner"
      ? [
          d.propertyType ? (PROPERTY_TYPE_LABELS[String(d.propertyType)] ?? titleCase(d.propertyType)) : null,
          d.location ? String(d.location) : null,
        ]
      : kind === "venue_partner"
        ? [d.location ? String(d.location) : null, d.seatedCapacity ? `${d.seatedCapacity} seated` : null]
        : kind === "agency"
          ? [d.businessType ? titleCase(d.businessType) : null, d.officeCity ? String(d.officeCity) : null]
          : [
              d.city ? String(d.city) : null,
              d.audienceLocation
                ? ((AUDIENCE_LOCATION_LABELS as Record<string, string>)[String(d.audienceLocation)] ?? String(d.audienceLocation))
                : null,
            ];
  return facts.filter((v): v is string => Boolean(v));
}

/** Hotel/venue star classification as a number for rendering actual star icons, rather than the "★ 1 star" text treatment. */
export function starRatingValue(d: Details): number | null {
  const n = Number(d.starRating);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "heic"]);

/** A quiet plain-text row read as a wall of filenames — a colored file-type chip (PDF red, image blue) makes each document scannable at a glance. */
export function DocFileIcon({ fileName }: { fileName: string }) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
        <FileText className="size-5" />
      </span>
    );
  }
  if (IMAGE_EXTENSIONS.has(ext)) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-chart-3/10 text-chart-3">
        <FileImage className="size-5" />
      </span>
    );
  }
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <FileIcon className="size-5" />
    </span>
  );
}

/**
 * `compact` drops to two columns, for grids rendered inside a half-width card.
 *
 * Labels are tracked micro-caps rather than sentence case — the data-panel
 * convention (Stripe, Linear) that reads as a real product rather than a raw
 * key dump. An unfilled field renders its "—" at reduced weight instead of
 * the same bold black as real data: at a glance, a page half full of bold
 * em-dashes reads as broken, not as "nothing here yet."
 */
export function DetailGrid({ rows, compact }: { rows: Array<[string, string]>; compact?: boolean }) {
  const visible = rows.filter(([, v]) => v !== "");
  if (visible.length === 0) return <p className="text-sm text-muted-foreground">No details submitted yet.</p>;
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", !compact && "lg:grid-cols-3")}>
      {visible.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className={cn("text-sm break-words", value === "—" ? "text-muted-foreground/50" : "font-semibold text-foreground")}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Pill list with an admin-console-appropriate "+N more" cap instead of a raw comma dump. */
export function PillList({ items, max = 6 }: { items: string[]; max?: number }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((item) => (
        <Badge key={item} variant="secondary" className="font-normal">
          {item}
        </Badge>
      ))}
      {extra > 0 ? (
        <Badge variant="secondary" className="font-normal text-muted-foreground">
          +{extra} more
        </Badge>
      ) : null}
    </div>
  );
}

type RoomTypeRow = { typeName?: string; count?: string; maxOccupancy?: string; basePriceUsd?: string };

/** Room types used to render as raw stringified JSON ({"count":"9","typeName":"..."}) — this renders the actual list a hotel partner filled in on their application. */
export function RoomTypesList({ roomTypes }: { roomTypes: unknown }) {
  const rows = Array.isArray(roomTypes) ? (roomTypes as RoomTypeRow[]) : [];
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No room types declared.</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((r, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-medium">{r.typeName || "Room"}</span>
          <span className="text-muted-foreground">
            {r.count ?? "?"} room{r.count === "1" ? "" : "s"} · up to {r.maxOccupancy ?? "?"} guests · $
            {r.basePriceUsd ?? "?"}/night
          </span>
        </li>
      ))}
    </ul>
  );
}

export function FullWidthField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sm:col-span-2 lg:col-span-3">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/**
 * Shared across agency / hotel_partner / venue_partner: steps 1+2 of the
 * wizard (business identity + authorized contact) write the exact same
 * business_details keys regardless of kind — one card, one layout, ordered
 * to read as a real business profile rather than a jsonb key dump.
 */
function BusinessIdentityFields(d: Details): Array<[string, string]> {
  return [
    ["Legal Business Name", s(d.legalBusinessName)],
    ["Trading Name", s(d.tradingName)],
    ["Business Type", d.businessType ? titleCase(d.businessType) : "—"],
    ["Year Established", s(d.yearEstablished)],
    ["Registration Number", s(d.registrationNumber)],
    ["Tax ID", s(d.taxId)],
  ];
}

/** Unprefixed — these render inside a card already titled "Authorized Contact". */
function ContactFields(d: Details): Array<[string, string]> {
  return [
    ["Name", s(d.contactFullName)],
    ["Role", s(d.contactRole)],
    ["ID Number", s(d.contactIdNumber)],
    ["Mobile", s(d.contactMobile)],
    ["Email", s(d.contactEmail)],
  ];
}

function AddressFields(d: Details): Array<[string, string]> {
  return [
    ["Office Street", s(d.officeStreet)],
    ["Office City", s(d.officeCity)],
    ["Office Region", s(d.officeRegion)],
    ["Business Phone", s(d.businessPhone)],
    ["Business Email", s(d.businessEmail)],
    ["Website", s(d.website)],
  ];
}

function SettlementFields(kind: ApplicationType, d: Details): Array<[string, string]> {
  if (kind === "agency") {
    return [
      ["Payment Model", d.paymentModel === "credit_line" ? "Credit line" : d.paymentModel ? "Prepaid wallet" : "—"],
      ["Requested Markup", d.requestedMarkupPercent == null || d.requestedMarkupPercent === "" ? "—" : `${d.requestedMarkupPercent}%`],
      ["Estimated Monthly Volume", s(d.estimatedMonthlyVolume)],
      ["Bank Name", s(d.bankName)],
      ["Account Name", s(d.bankAccountName)],
      ["Account Number", s(d.bankAccountNumber)],
    ];
  }
  return [
    ["Payout Frequency", d.payoutFrequency ? (PAYOUT_FREQUENCY_LABELS[String(d.payoutFrequency)] ?? titleCase(d.payoutFrequency)) : "—"],
    ["Bank Name", s(d.bankName)],
    ["Account Name", s(d.bankAccountName)],
    ["Account Number", s(d.bankAccountNumber)],
  ];
}

type Branch = { name?: string; location?: string };

/**
 * One card per step the applicant actually filled in, in the same order the
 * wizard asked for them. Previously all of this was a single "Business
 * Details" card with six Separator-delimited blocks, which buried the
 * authorized contact in the middle of the business record — an admin
 * comparing this page against the wizard couldn't line the two up.
 */
export function BusinessDetailsCard({
  kind,
  details,
  elevated,
}: {
  kind: ApplicationType;
  details: Details;
  /** Soft shadow instead of the plain flat card — opt-in for the customer-facing
   * view page, which wants more visual weight than the admin console's
   * intentionally flat treatment. Undefined everywhere else keeps every
   * existing admin usage pixel-identical. */
  elevated?: boolean;
}) {
  const d = details;
  const branches = Array.isArray(d.branches) ? (d.branches as Branch[]).filter((b) => b?.name || b?.location) : [];
  const cardClass = elevated ? "shadow-sm" : undefined;

  return (
    <>
      <Card className={cardClass}>
        <CardHeader>
          <SectionTitle>Business</SectionTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailGrid rows={BusinessIdentityFields(d)} />
          <Separator />
          <DetailGrid rows={AddressFields(d)} />
          {branches.length > 0 ? (
            <FullWidthField label="Branch Offices">
              <ul className="space-y-1 text-sm">
                {branches.map((b, i) => (
                  <li key={i}>
                    {b.name || "Branch"}
                    {b.location ? ` — ${b.location}` : ""}
                  </li>
                ))}
              </ul>
            </FullWidthField>
          ) : null}
          {kind === "agency" ? (
            <>
              <Separator />
              <DetailGrid
                rows={[
                  ["Years of Experience", s(d.yearsExperience)],
                  ["Staff Count", s(d.staffCount)],
                  ["Monthly Volume", s(d.monthlyVolume)],
                  ["IATA Number", s(d.iataNumber)],
                ]}
              />
              <FullWidthField label="Products">
                <PillList items={Array.isArray(d.products) ? (d.products as string[]).map(titleCase) : []} />
              </FullWidthField>
            </>
          ) : null}
        </CardContent>
      </Card>

      {kind === "hotel_partner" ? (
        <Card className={cardClass}>
          <CardHeader>
            <SectionTitle>Property</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailGrid
              rows={[
                ["Property Name", s(d.propertyName)],
                ["Property Type", d.propertyType ? (PROPERTY_TYPE_LABELS[String(d.propertyType)] ?? titleCase(d.propertyType)) : "—"],
                ["Star Rating", d.starRating ? `★ ${STAR_RATING_LABELS[String(d.starRating)] ?? d.starRating}` : "—"],
                ["Location", s(d.location)],
                ["Property Street", s(d.propertyStreet)],
                ["Total Rooms", s(d.totalRooms)],
                ["Check-in Time", s(d.checkInTime)],
                ["Check-out Time", s(d.checkOutTime)],
                [
                  "Cancellation Policy",
                  d.cancellationPolicy ? (CANCELLATION_POLICY_LABELS[String(d.cancellationPolicy)]?.label ?? titleCase(d.cancellationPolicy)) : "—",
                ],
              ]}
            />
            <FullWidthField label="Room Types">
              <RoomTypesList roomTypes={d.roomTypes} />
            </FullWidthField>
            <FullWidthField label="Amenities">
              <PillList items={Array.isArray(d.amenities) ? (d.amenities as string[]).map((a) => AMENITY_LABELS[a] ?? titleCase(a)) : []} />
            </FullWidthField>
          </CardContent>
        </Card>
      ) : null}

      {kind === "venue_partner" ? (
        <Card className={cardClass}>
          <CardHeader>
            <SectionTitle>Venue</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DetailGrid
              rows={[
                ["Venue Name", s(d.venueName)],
                ["Location", s(d.location)],
                ["Seated Capacity", s(d.seatedCapacity)],
                ["Standing Capacity", s(d.standingCapacity)],
                ["Indicative Price", d.indicativePrice ? `USD ${d.indicativePrice}` : "—"],
              ]}
            />
            <FullWidthField label="Event Types">
              <PillList items={Array.isArray(d.eventTypes) ? (d.eventTypes as string[]).map(titleCase) : []} />
            </FullWidthField>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={cardClass}>
          <CardHeader>
            <SectionTitle>Authorized Contact</SectionTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid rows={ContactFields(d)} compact />
          </CardContent>
        </Card>
        <Card className={cardClass}>
          <CardHeader>
            <SectionTitle>Settlement</SectionTitle>
          </CardHeader>
          <CardContent>
            <DetailGrid rows={SettlementFields(kind, d)} compact />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/** "platform: handle" per row, skipping fully-empty ones the applicant never filled in. */
function formatHandles(handles: unknown): string {
  if (!Array.isArray(handles)) return "";
  return (handles as Array<{ platform?: string; handle?: string }>)
    .filter((h) => h?.platform || h?.handle)
    .map((h) => [h.platform, h.handle].filter(Boolean).join(": "))
    .join(", ");
}

/**
 * Affiliate's business_details shape has nothing in common with the other
 * three kinds (see partner-applications/actions.ts step1AffiliateSchema
 * etc.) — kept as its own grouped rendering, mirroring the applicant's own
 * 3-step review (About You / Verification / Audience & Reach).
 */
export function AffiliateDetailCards({ details, elevated }: { details: Details; elevated?: boolean }) {
  const d = details;
  const cardClass = elevated ? "shadow-sm" : undefined;
  return (
    <>
      <Card className={cardClass}>
        <CardHeader>
          <SectionTitle>About You</SectionTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid
            rows={[
              ["Full Name", s(d.fullName)],
              ["City", s(d.city)],
              ["Audience Location", d.audienceLocation ? ((AUDIENCE_LOCATION_LABELS as Record<string, string>)[String(d.audienceLocation)] ?? String(d.audienceLocation)) : "—"],
              ["Mobile", s(d.mobile)],
              ["Email", s(d.email)],
            ]}
          />
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader>
          <SectionTitle>Verification</SectionTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid rows={[["ID Number", s(d.idNumber)]]} />
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader>
          <SectionTitle>Audience &amp; Reach</SectionTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DetailGrid
            rows={[
              ["Website / Social Handles", formatHandles(d.handles) || "—"],
              ["Audience Size", s(d.audienceSize)],
              ["Traffic Source", d.trafficSource ? humanizeKey(String(d.trafficSource)) : "—"],
            ]}
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Promotion Plan</p>
            <p className={cn("text-sm break-words", s(d.promotionPlan) === "—" ? "text-muted-foreground/50" : "font-semibold text-foreground")}>
              {s(d.promotionPlan)}
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
