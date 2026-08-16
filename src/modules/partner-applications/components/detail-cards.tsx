import type { LucideIcon } from "lucide-react";
import { Building2, User, ShieldCheck, MapPin } from "lucide-react";
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

/** Every card header sharing this component gets the same icon-chip treatment, matching this app's existing IconChip convention (admin dashboard, hero deal cards) rather than inventing a one-off style. */
export function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <CardTitle className="flex items-center gap-2.5 text-base">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4.5" />
      </span>
      {children}
    </CardTitle>
  );
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

export function DetailGrid({ rows }: { rows: Array<[string, string]> }) {
  const visible = rows.filter(([, v]) => v !== "");
  if (visible.length === 0) return <p className="text-sm text-muted-foreground">No details submitted yet.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="text-sm font-medium break-words">{value}</dd>
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
      <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
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

function ContactFields(d: Details): Array<[string, string]> {
  return [
    ["Contact Name", s(d.contactFullName)],
    ["Contact Role", s(d.contactRole)],
    ["Contact ID Number", s(d.contactIdNumber)],
    ["Contact Mobile", s(d.contactMobile)],
    ["Contact Email", s(d.contactEmail)],
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

export function BusinessDetailsCard({ kind, details }: { kind: ApplicationType; details: Details }) {
  const d = details;
  const branches = Array.isArray(d.branches) ? (d.branches as Branch[]).filter((b) => b?.name || b?.location) : [];

  return (
    <Card>
      <CardHeader>
        <SectionTitle icon={Building2}>Business Details</SectionTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <DetailGrid rows={BusinessIdentityFields(d)} />

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

        {kind === "hotel_partner" ? (
          <>
            <Separator />
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
          </>
        ) : null}

        {kind === "venue_partner" ? (
          <>
            <Separator />
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
          </>
        ) : null}

        <Separator />
        <DetailGrid rows={ContactFields(d)} />

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

        <Separator />
        <DetailGrid rows={SettlementFields(kind, d)} />
      </CardContent>
    </Card>
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
export function AffiliateDetailCards({ details }: { details: Details }) {
  const d = details;
  return (
    <>
      <Card>
        <CardHeader>
          <SectionTitle icon={User}>About You</SectionTitle>
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

      <Card>
        <CardHeader>
          <SectionTitle icon={ShieldCheck}>Verification</SectionTitle>
        </CardHeader>
        <CardContent>
          <DetailGrid rows={[["ID Number", s(d.idNumber)]]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionTitle icon={MapPin}>Audience &amp; Reach</SectionTitle>
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
            <p className="text-xs text-muted-foreground">Promotion Plan</p>
            <p className="text-sm font-medium break-words">{s(d.promotionPlan)}</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
