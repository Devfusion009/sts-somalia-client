"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/money";
import { SubmitButton } from "@/components/submit-button";
import {
  saveUmrahHotel,
  deleteUmrahHotel,
  saveUmrahItineraryDay,
  deleteUmrahItineraryDay,
  saveUmrahPricing,
  deleteUmrahPricing,
  setUmrahPackageAgencies,
} from "@/modules/umrah/admin-actions";
import { sharingLabel } from "@/modules/umrah/images";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

function ErrorAlert({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Hotels
// ---------------------------------------------------------------------------
export type PackageHotel = {
  id: string;
  city: string;
  name: string;
  star_rating: number | null;
  distance_to_haram_m: number | null;
  nights: number | null;
  room_type: string | null;
  sort_order: number;
};

const CITY_LABELS: Record<string, string> = { makkah: "Makkah", madinah: "Madinah", other: "Other" };

export function HotelsManager({ packageId, hotels }: { packageId: string; hotels: PackageHotel[] }) {
  const [state, formAction] = useActionState(saveUmrahHotel, null);

  return (
    <div className="space-y-4">
      {hotels.length > 0 ? (
        <ul className="divide-y divide-border">
          {hotels.map((h) => (
            <li key={h.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{CITY_LABELS[h.city] ?? h.city}</Badge>
                  <span className="font-medium">{h.name}</span>
                  {h.star_rating ? (
                    <span className="text-sm text-brand-gold" role="img" aria-label={`${h.star_rating} stars`}>
                      {"★".repeat(h.star_rating)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                  {h.distance_to_haram_m ? `${h.distance_to_haram_m}m from Haram` : "Distance not set"}
                  {h.nights ? ` · ${h.nights} night${h.nights === 1 ? "" : "s"}` : ""}
                  {h.room_type ? ` · ${h.room_type}` : ""}
                </p>
              </div>
              <form action={deleteUmrahHotel}>
                <input type="hidden" name="packageId" value={packageId} />
                <input type="hidden" name="hotelRowId" value={h.id} />
                <ConfirmButton
                  title="Remove this hotel?"
                  confirmLabel="Remove"
                  aria-label={`Remove ${h.name}`}
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={formAction} className="space-y-4 border-t border-border pt-4">
        <input type="hidden" name="packageId" value={packageId} />
        <ErrorAlert error={state?.error} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="city">City</FieldLabel>
            <select id="city" name="city" defaultValue="makkah" className={NATIVE_SELECT_CLASS}>
              <option value="makkah">Makkah</option>
              <option value="madinah">Madinah</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field className="col-span-2">
            <FieldLabel htmlFor="hotelName">Hotel name</FieldLabel>
            <Input id="hotelName" name="name" placeholder="Waha Al Deafah Hotel" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="starRating">Stars</FieldLabel>
            <Input id="starRating" name="starRating" type="number" min={1} max={5} placeholder="3" />
          </Field>
          <Field>
            <FieldLabel htmlFor="distanceToHaramM">Distance to Haram (m)</FieldLabel>
            <Input id="distanceToHaramM" name="distanceToHaramM" type="number" min={0} placeholder="650" />
          </Field>
          <Field>
            <FieldLabel htmlFor="nights">Nights</FieldLabel>
            <Input id="nights" name="nights" type="number" min={1} placeholder="7" />
          </Field>
          <Field className="col-span-2">
            <FieldLabel htmlFor="roomType">Room type</FieldLabel>
            <Input id="roomType" name="roomType" placeholder="Quad sharing, sea view" />
          </Field>
          <Field>
            <FieldLabel htmlFor="sortOrder">Order</FieldLabel>
            <Input id="sortOrder" name="sortOrder" type="number" min={0} max={99} defaultValue={hotels.length} />
          </Field>
        </div>
        <div className="flex justify-end">
          <SubmitButton variant="outline" pendingText="Adding…">
            <Plus aria-hidden="true" /> Add hotel
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Itinerary
// ---------------------------------------------------------------------------
export type ItineraryDay = { id: string; day_number: number; title: string; description: string | null };

export function ItineraryManager({
  packageId,
  days,
  durationDays,
}: {
  packageId: string;
  days: ItineraryDay[];
  durationDays: number;
}) {
  const [state, formAction] = useActionState(saveUmrahItineraryDay, null);
  const nextDay = days.length > 0 ? Math.max(...days.map((d) => d.day_number)) + 1 : 1;

  return (
    <div className="space-y-4">
      {days.length > 0 ? (
        <ol className="divide-y divide-border">
          {days.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 py-3 first:pt-0">
              <div className="flex min-w-0 gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                  {d.day_number}
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{d.title}</p>
                  {d.description ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{d.description}</p>
                  ) : null}
                </div>
              </div>
              <form action={deleteUmrahItineraryDay}>
                <input type="hidden" name="packageId" value={packageId} />
                <input type="hidden" name="dayId" value={d.id} />
                <ConfirmButton
                  title="Delete this itinerary day?"
                  aria-label={`Delete day ${d.day_number}`}
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ol>
      ) : null}

      <form action={formAction} className="space-y-4 border-t border-border pt-4">
        <input type="hidden" name="packageId" value={packageId} />
        <ErrorAlert error={state?.error} />
        <div className="grid grid-cols-[5rem_1fr] gap-4">
          <Field>
            <FieldLabel htmlFor="dayNumber">Day</FieldLabel>
            <Input id="dayNumber" name="dayNumber" type="number" min={1} max={durationDays} defaultValue={nextDay} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="dayTitle">Title</FieldLabel>
            <Input id="dayTitle" name="title" placeholder="Arrival in Jeddah & transfer to Makkah" required />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="dayDescription">Description</FieldLabel>
          <Textarea
            id="dayDescription"
            name="description"
            rows={2}
            placeholder="Meet & greet at Jeddah airport, private coach to the hotel, check-in, first Umrah with our guide."
          />
        </Field>
        <div className="flex justify-end">
          <SubmitButton variant="outline" pendingText="Adding…">
            <Plus aria-hidden="true" /> Add day
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rate card
// ---------------------------------------------------------------------------
export type PricingRow = { id: string; sharing: number; price: number };

export function PricingManager({
  packageId,
  rows,
  currency,
}: {
  packageId: string;
  rows: PricingRow[];
  currency: string;
}) {
  const [state, formAction] = useActionState(saveUmrahPricing, null);
  const cheapest = rows.length > 0 ? Math.min(...rows.map((r) => Number(r.price))) : null;

  return (
    <div className="space-y-4">
      {rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">{sharingLabel(r.sharing)}</span>
                {Number(r.price) === cheapest ? (
                  <Badge variant="success">Starting price</Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tabular-nums">{money(r.price, currency)}</span>
                <form action={deleteUmrahPricing}>
                  <input type="hidden" name="packageId" value={packageId} />
                  <input type="hidden" name="pricingId" value={r.id} />
                  <ConfirmButton
                    title="Delete this price?"
                    aria-label={`Delete ${sharingLabel(r.sharing)} price`}
                    size="icon-sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 />
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={formAction} className="space-y-4 border-t border-border pt-4">
        <input type="hidden" name="packageId" value={packageId} />
        <ErrorAlert error={state?.error} />
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="sharing">Pilgrims per room</FieldLabel>
            <Input id="sharing" name="sharing" type="number" min={1} max={12} placeholder="4" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="price">Price per pilgrim ({currency})</FieldLabel>
            <Input id="price" name="price" type="number" min={0} step="0.01" placeholder="1250" className="tabular-nums" required />
          </Field>
        </div>
        <div className="flex justify-end">
          <SubmitButton variant="outline" pendingText="Saving…">
            <Plus aria-hidden="true" /> Save rate
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local agencies
// ---------------------------------------------------------------------------
export type AgencyOption = { id: string; name: string; contact_email: string; country_code: string | null };

export function AgenciesPicker({
  packageId,
  agencies,
  selectedIds,
}: {
  packageId: string;
  agencies: AgencyOption[];
  selectedIds: string[];
}) {
  const [state, formAction] = useActionState(setUmrahPackageAgencies, null);

  if (agencies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No active agencies</p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="packageId" value={packageId} />
      <ErrorAlert error={state?.error} />
      {state?.error === null ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Agency assignments saved.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {agencies.map((a) => (
          <label
            key={a.id}
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted/50 has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="checkbox"
              name="agencyIds"
              value={a.id}
              defaultChecked={selectedIds.includes(a.id)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span className="min-w-0">
              <span className="block font-medium">{a.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.contact_email}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">Save agencies</SubmitButton>
      </div>
    </form>
  );
}
