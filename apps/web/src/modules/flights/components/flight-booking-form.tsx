"use client";

import { useActionState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CountrySearchSelect } from "@/components/ui/country-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/submit-button";
import { bookFlight, type BookFlightState } from "../actions";

export type PassengerDefaults = {
  firstName?: string | null;
  lastName?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  passportCountry?: string | null;
};

function PassengerFields({ index, total, defaults }: { index: number; total: number; defaults?: PassengerDefaults }) {
  const id = (key: string) => `p${index}_${key}`;
  const gender = defaults?.gender?.toLowerCase();
  return (
    <fieldset className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
      <legend className="px-1 font-heading text-sm font-semibold">
        {total > 1 ? `Passenger ${index + 1}` : "Passenger"}
      </legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={id("firstName")}>First and middle names</FieldLabel>
          <Input id={id("firstName")} name={id("firstName")} defaultValue={defaults?.firstName ?? ""} autoComplete="given-name" required />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("lastName")}>Last name</FieldLabel>
          <Input id={id("lastName")} name={id("lastName")} defaultValue={defaults?.lastName ?? ""} autoComplete="family-name" required />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("gender")}>Gender</FieldLabel>
          <select id={id("gender")} name={id("gender")} defaultValue={gender === "male" || gender === "female" ? gender : ""} required className={NATIVE_SELECT_CLASS}>
            <option value="" disabled>
              Select
            </option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor={id("dateOfBirth")}>Date of birth</FieldLabel>
          <Input id={id("dateOfBirth")} name={id("dateOfBirth")} type="date" defaultValue={defaults?.dateOfBirth ?? ""} required />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("nationality")}>Nationality</FieldLabel>
          <CountrySearchSelect id={id("nationality")} name={id("nationality")} defaultValue={defaults?.nationality ?? ""} placeholder="Select country" required />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("passportNumber")}>Passport number</FieldLabel>
          <Input id={id("passportNumber")} name={id("passportNumber")} defaultValue={defaults?.passportNumber ?? ""} className="uppercase" required />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("passportCountry")}>Issuing country</FieldLabel>
          <CountrySearchSelect id={id("passportCountry")} name={id("passportCountry")} defaultValue={defaults?.passportCountry ?? ""} placeholder="Select country" required />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("passportExpiry")}>Passport expiry</FieldLabel>
          <Input id={id("passportExpiry")} name={id("passportExpiry")} type="date" defaultValue={defaults?.passportExpiry ?? ""} required />
        </Field>
      </div>
    </fieldset>
  );
}

/**
 * Passenger and contact details for the selected fare. Names must match the
 * passport; the airline rejects a ticket that doesn't.
 */
export function FlightBookingForm({
  offerId,
  passengerCount,
  passengers = [],
  contactEmail,
  contactPhone,
  desk = false,
  agencyCustomerId,
  walletOption,
  submitLabel,
}: {
  offerId: string;
  passengerCount: number;
  passengers?: PassengerDefaults[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  desk?: boolean;
  agencyCustomerId?: string;
  /** Agency desk: the wallet line shown with the payment choice. */
  walletOption?: ReactNode;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<BookFlightState, FormData>(bookFlight, null);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="offerId" value={offerId} />
      <input type="hidden" name="passengerCount" value={passengerCount} />
      {desk ? <input type="hidden" name="desk" value="1" /> : null}
      {agencyCustomerId ? <input type="hidden" name="agencyCustomerId" value={agencyCustomerId} /> : null}

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        {Array.from({ length: passengerCount }, (_, index) => (
          <PassengerFields key={index} index={index} total={passengerCount} defaults={passengers[index]} />
        ))}
      </div>

      <fieldset className="space-y-4 rounded-xl border border-border p-4 sm:p-5">
        <legend className="px-1 font-heading text-sm font-semibold">Contact for this booking</legend>
        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="contactEmail">Email</FieldLabel>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={contactEmail ?? ""} autoComplete="email" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactPhone">Mobile number</FieldLabel>
            <PhoneInput id="contactPhone" name="contactPhone" defaultValue={contactPhone ?? ""} required />
          </Field>
        </FieldGroup>
      </fieldset>

      {walletOption ? (
        <fieldset className="space-y-2 rounded-xl border border-border p-4 sm:p-5">
          <legend className="px-1 font-heading text-sm font-semibold">Payment</legend>
          <label className="flex items-center gap-3 text-sm">
            <input type="radio" name="payment" value="wallet" defaultChecked className="size-4 accent-primary" />
            {walletOption}
          </label>
          <label className="flex items-center gap-3 text-sm">
            <input type="radio" name="payment" value="later" className="size-4 accent-primary" />
            Pay from the booking
          </label>
        </fieldset>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton size="lg" pendingText="Booking with the airline…">
          {submitLabel} <ArrowRight data-icon="inline-end" aria-hidden="true" />
        </SubmitButton>
      </div>
    </form>
  );
}
