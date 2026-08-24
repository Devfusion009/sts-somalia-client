"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
        <div className="space-y-2">
          {hotels.map((h) => (
            <div key={h.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{CITY_LABELS[h.city] ?? h.city}</Badge>
                  <span className="font-medium">{h.name}</span>
                  {h.star_rating ? (
                    <span className="text-sm text-brand-gold">{"★".repeat(h.star_rating)}</span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {h.distance_to_haram_m ? `${h.distance_to_haram_m}m from Haram` : "Distance not set"}
                  {h.nights ? ` · ${h.nights} night${h.nights === 1 ? "" : "s"}` : ""}
                  {h.room_type ? ` · ${h.room_type}` : ""}
                </p>
              </div>
              <form action={deleteUmrahHotel}>
                <input type="hidden" name="packageId" value={packageId} />
                <input type="hidden" name="hotelRowId" value={h.id} />
                <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </form>
            </div>
          ))}
        </div>
      ) : null}

      <form action={formAction} className="space-y-3 rounded-lg border border-dashed border-border p-4">
        <input type="hidden" name="packageId" value={packageId} />
        <ErrorAlert error={state?.error} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <select id="city" name="city" defaultValue="makkah" className={selectClass}>
              <option value="makkah">Makkah</option>
              <option value="madinah">Madinah</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="hotelName">Hotel name</Label>
            <Input id="hotelName" name="name" placeholder="Waha Al Deafah Hotel" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="starRating">Stars</Label>
            <Input id="starRating" name="starRating" type="number" min={1} max={5} placeholder="3" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="distanceToHaramM">Distance to Haram (m)</Label>
            <Input id="distanceToHaramM" name="distanceToHaramM" type="number" min={0} placeholder="650" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nights">Nights</Label>
            <Input id="nights" name="nights" type="number" min={1} placeholder="7" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="roomType">Room type</Label>
            <Input id="roomType" name="roomType" placeholder="Quad sharing, sea view" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sortOrder">Order</Label>
            <Input id="sortOrder" name="sortOrder" type="number" min={0} max={99} defaultValue={hotels.length} />
          </div>
        </div>
        <SubmitButton size="sm" pendingText="Adding…">
          <Plus className="size-4" /> Add hotel
        </SubmitButton>
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
        <ol className="space-y-2">
          {days.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
              <div className="flex min-w-0 gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
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
                <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </Button>
              </form>
            </li>
          ))}
        </ol>
      ) : null}

      <form action={formAction} className="space-y-3 rounded-lg border border-dashed border-border p-4">
        <input type="hidden" name="packageId" value={packageId} />
        <ErrorAlert error={state?.error} />
        <div className="grid gap-3 sm:grid-cols-[100px_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="dayNumber">Day</Label>
            <Input id="dayNumber" name="dayNumber" type="number" min={1} max={durationDays} defaultValue={nextDay} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dayTitle">Title</Label>
            <Input id="dayTitle" name="title" placeholder="Arrival in Jeddah & transfer to Makkah" required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dayDescription">Description</Label>
          <Textarea
            id="dayDescription"
            name="description"
            rows={2}
            placeholder="Meet & greet at Jeddah airport, private coach to the hotel, check-in, first Umrah with our guide."
          />
        </div>
        <SubmitButton size="sm" pendingText="Adding…">
          <Plus className="size-4" /> Add day
        </SubmitButton>
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
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{sharingLabel(r.sharing)}</span>
                {Number(r.price) === cheapest ? (
                  <Badge className="border-transparent bg-primary/10 text-primary">Starting price</Badge>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {currency} {Number(r.price).toFixed(2)}
                </span>
                <form action={deleteUmrahPricing}>
                  <input type="hidden" name="packageId" value={packageId} />
                  <input type="hidden" name="pricingId" value={r.id} />
                  <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </Button>
                </form>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            The cheapest rate becomes the package&apos;s charged base price and the &ldquo;starting from&rdquo; figure
            customers see.
          </p>
        </div>
      ) : null}

      <form action={formAction} className="space-y-3 rounded-lg border border-dashed border-border p-4">
        <input type="hidden" name="packageId" value={packageId} />
        <ErrorAlert error={state?.error} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="sharing">Pilgrims per room</Label>
            <Input id="sharing" name="sharing" type="number" min={1} max={12} placeholder="4" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Price per pilgrim ({currency})</Label>
            <Input id="price" name="price" type="number" min={0} step="0.01" placeholder="1250" required />
          </div>
        </div>
        <SubmitButton size="sm" pendingText="Saving…">
          <Plus className="size-4" /> Add / update rate
        </SubmitButton>
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
      <p className="py-6 text-center text-sm text-muted-foreground">
        No active agencies yet.
      </p>
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
            className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-sm has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="checkbox"
              name="agencyIds"
              value={a.id}
              defaultChecked={selectedIds.includes(a.id)}
              className="mt-0.5 size-4"
            />
            <span className="min-w-0">
              <span className="block font-medium">{a.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.contact_email}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Internal assignment — linked agencies can see they handle this package. Not shown to the public.
      </p>
      <SubmitButton pendingText="Saving…">Save agencies</SubmitButton>
    </form>
  );
}
