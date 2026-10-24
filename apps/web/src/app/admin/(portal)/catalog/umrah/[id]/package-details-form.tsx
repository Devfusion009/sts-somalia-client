"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { updateUmrahPackageDetails } from "@/modules/umrah/admin-actions";
import { countryFlag } from "@/lib/countries";
import type { Airport } from "@sts/shared-types";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

// Basic / Standard / Premium is the ladder the group product is sold on.
// Economy and VIP stay listed because live packages already carry them and
// removing an option would make those rows un-resavable at their own tier.
const TIERS = ["Basic", "Standard", "Premium", "Economy", "VIP"];

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
      <SelectTrigger id={id} className="w-full" aria-label={placeholder}>
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
  depositPercent,
  balanceDueDays,
  fullPaymentBeforeDocuments,
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
  depositPercent: number | null;
  balanceDueDays: number;
  fullPaymentBeforeDocuments: boolean;
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

      <Field>
        <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
        <Input
          id="tagline"
          name="tagline"
          defaultValue={tagline ?? ""}
          placeholder="Mogadishu's most trusted 14-night Umrah"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="tier">Tier badge</FieldLabel>
          <select id="tier" name="tier" defaultValue={tier ?? ""} className={NATIVE_SELECT_CLASS}>
            <option value="">No tier badge</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="originIata">From (airport)</FieldLabel>
          <AirportSelect
            id="originIata"
            name="originIata"
            airports={airports}
            defaultValue={originIata ?? ""}
            placeholder="Select origin"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="destinationIata">To (airport)</FieldLabel>
          <AirportSelect
            id="destinationIata"
            name="destinationIata"
            airports={airports}
            defaultValue={destinationIata ?? ""}
            placeholder="Select destination"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="originalPrice">Was price ({currency})</FieldLabel>
          <Input
            id="originalPrice"
            name="originalPrice"
            type="number"
            min={0}
            step="0.01"
            defaultValue={originalPrice ?? ""}
            placeholder="No discount"
            className="tabular-nums"
          />
        </Field>
        <div className="flex items-end">
          <label className="flex h-8 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="isFeatured" defaultChecked={isFeatured} className="size-4 accent-primary" />
            Highlight as <span className="font-medium">Most Popular</span>
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="mealPlan">Meals</FieldLabel>
          <select id="mealPlan" name="mealPlan" defaultValue={mealPlan} className={NATIVE_SELECT_CLASS}>
            <option value="none">No meals included</option>
            <option value="breakfast">Breakfast only</option>
            <option value="half_board">Half board (breakfast + dinner)</option>
            <option value="full_board">Full board (all meals)</option>
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="mealsNote">Food notes</FieldLabel>
          <Input
            id="mealsNote"
            name="mealsNote"
            defaultValue={mealsNote ?? ""}
            placeholder="Somali & Arabic buffet, halal certified"
          />
        </Field>
      </div>

      <FieldSet className="gap-4 border-t border-border pt-5">
        <FieldLegend>Responsible person</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="contactPersonName">Name</FieldLabel>
            <Input id="contactPersonName" name="contactPersonName" defaultValue={contactPersonName ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactPersonPhone">Phone</FieldLabel>
            <Input
              id="contactPersonPhone"
              name="contactPersonPhone"
              type="tel"
              defaultValue={contactPersonPhone ?? ""}
              placeholder="+252 61 144 4420"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactWhatsapp">WhatsApp</FieldLabel>
            <Input
              id="contactWhatsapp"
              name="contactWhatsapp"
              defaultValue={contactWhatsapp ?? ""}
              placeholder="252611444420"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactPersonEmail">Email</FieldLabel>
            <Input
              id="contactPersonEmail"
              name="contactPersonEmail"
              type="email"
              defaultValue={contactPersonEmail ?? ""}
            />
          </Field>
        </div>
      </FieldSet>

      <FieldSet className="gap-4 border-t border-border pt-5">
        <FieldLegend>Payment terms</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="depositPercent">Deposit (%)</FieldLabel>
            <Input
              id="depositPercent"
              name="depositPercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              placeholder="50"
              defaultValue={depositPercent ?? ""}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="balanceDueDays">Balance due (days before)</FieldLabel>
            <Input
              id="balanceDueDays"
              name="balanceDueDays"
              type="number"
              min={0}
              max={180}
              defaultValue={balanceDueDays}
              required
            />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="fullPaymentBeforeDocuments"
            defaultChecked={fullPaymentBeforeDocuments}
            className="size-4 accent-primary"
          />
          Full payment before e-tickets and hotel vouchers
        </label>
      </FieldSet>

      <div className="flex justify-end border-t border-border pt-5">
        <SubmitButton pendingText="Saving…">Save details</SubmitButton>
      </div>
    </form>
  );
}
