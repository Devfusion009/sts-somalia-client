"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { updateUmrahPackageDetails } from "@/modules/umrah/admin-actions";
import { countryFlag } from "@/lib/countries";
import type { Airport } from "@/modules/flights/queries";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const TIERS = ["Economy", "Standard", "Premium", "VIP"];

/** Same pattern as flight-search-form.tsx's AirportSelect — this form isn't shared with it, so kept local rather than a premature shared export. */
function AirportSelect({
  id,
  name,
  airports,
  defaultValue,
  placeholder,
}: {
  id: string;
  name: string;
  airports: Airport[];
  defaultValue?: string;
  placeholder: string;
}) {
  return (
    <Select name={name} defaultValue={defaultValue || undefined}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {airports.map((airport) => (
          <SelectItem key={airport.iata_code} value={airport.iata_code}>
            {countryFlag(airport.country_code)} {airport.city} ({airport.iata_code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PackageDetailsForm({
  packageId,
  tagline,
  tier,
  isFeatured,
  originIata,
  destinationIata,
  airports,
  originalPrice,
  currency,
  mealPlan,
  mealsNote,
  contactPersonName,
  contactPersonPhone,
  contactPersonEmail,
  contactWhatsapp,
}: {
  packageId: string;
  tagline: string | null;
  tier: string | null;
  isFeatured: boolean;
  originIata: string | null;
  destinationIata: string | null;
  airports: Airport[];
  originalPrice: number | null;
  currency: string;
  mealPlan: string;
  mealsNote: string | null;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  contactPersonEmail: string | null;
  contactWhatsapp: string | null;
}) {
  const [state, formAction] = useActionState(updateUmrahPackageDetails, null);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="packageId" value={packageId} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state?.error === null ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Package details saved.</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="tagline">Tagline</Label>
        <Input
          id="tagline"
          name="tagline"
          defaultValue={tagline ?? ""}
          placeholder="Mogadishu's most trusted 14-night Umrah"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="tier">Tier badge</Label>
          <select id="tier" name="tier" defaultValue={tier ?? ""} className={selectClass}>
            <option value="">No tier badge</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Shown as a badge on the card.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="originIata">From (airport)</Label>
          <AirportSelect
            id="originIata"
            name="originIata"
            airports={airports}
            defaultValue={originIata ?? ""}
            placeholder="Select origin"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destinationIata">To (airport)</Label>
          <AirportSelect
            id="destinationIata"
            name="destinationIata"
            airports={airports}
            defaultValue={destinationIata ?? ""}
            placeholder="Select destination"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="originalPrice">Was price ({currency})</Label>
          <Input
            id="originalPrice"
            name="originalPrice"
            type="number"
            min={0}
            step="0.01"
            defaultValue={originalPrice ?? ""}
            placeholder="Leave blank for no discount"
          />
          <p className="text-xs text-muted-foreground">
            Shown struck through next to the live price, with the discount percentage.
          </p>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="isFeatured" defaultChecked={isFeatured} className="size-4" />
            Highlight as <span className="font-medium">Most Popular</span>
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mealPlan">Meals</Label>
          <select id="mealPlan" name="mealPlan" defaultValue={mealPlan} className={selectClass}>
            <option value="none">No meals included</option>
            <option value="breakfast">Breakfast only</option>
            <option value="half_board">Half board (breakfast + dinner)</option>
            <option value="full_board">Full board (all meals)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mealsNote">Food notes</Label>
          <Input
            id="mealsNote"
            name="mealsNote"
            defaultValue={mealsNote ?? ""}
            placeholder="Somali & Arabic buffet, halal certified"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <p className="text-sm font-medium">Responsible person</p>
        <p className="-mt-2 text-xs text-muted-foreground">
          Shown on the public package page so pilgrims and agents know exactly who to call.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contactPersonName">Name</Label>
            <Input id="contactPersonName" name="contactPersonName" defaultValue={contactPersonName ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactPersonPhone">Phone</Label>
            <Input
              id="contactPersonPhone"
              name="contactPersonPhone"
              type="tel"
              defaultValue={contactPersonPhone ?? ""}
              placeholder="+252 61 144 4420"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactWhatsapp">WhatsApp</Label>
            <Input
              id="contactWhatsapp"
              name="contactWhatsapp"
              defaultValue={contactWhatsapp ?? ""}
              placeholder="252611444420"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactPersonEmail">Email</Label>
            <Input
              id="contactPersonEmail"
              name="contactPersonEmail"
              type="email"
              defaultValue={contactPersonEmail ?? ""}
            />
          </div>
        </div>
      </div>

      <SubmitButton pendingText="Saving…">Save details</SubmitButton>
    </form>
  );
}
