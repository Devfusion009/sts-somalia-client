"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CountrySearchSelect } from "@/components/ui/country-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { SubmitButton } from "@/components/submit-button";
import { updateAgencyProfileAction } from "@/modules/agencies/settings-actions";

export const PROFILE_FIELD = "h-11 rounded-xl border-transparent bg-secondary/70 px-3.5 shadow-none focus-visible:bg-card";
const ABOUT_LIMIT = 600;

/** One settings block: heading on the left, its fields on the right. */
export function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-5 px-5 py-6 sm:px-7 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
      <h2 className="font-heading text-base font-semibold">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Required() {
  return <span className="text-destructive" aria-hidden="true">*</span>;
}

export function AgencyProfileForm({
  name,
  legalName,
  registrationNumber,
  contactEmail,
  contactPhone,
  countryCode,
  about,
  website,
  address,
}: {
  name: string;
  legalName: string | null;
  registrationNumber: string | null;
  contactEmail: string;
  contactPhone: string | null;
  countryCode: string | null;
  about: string | null;
  website: string | null;
  address: string | null;
}) {
  const [state, formAction] = useActionState(updateAgencyProfileAction, null);
  const [aboutLength, setAboutLength] = useState(about?.length ?? 0);

  return (
    <form action={formAction} className="divide-y divide-border">
      <ProfileSection title="Business details">
        <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">Agency name <Required /></FieldLabel>
            <Input id="name" name="name" autoComplete="organization" defaultValue={name} required className={`${PROFILE_FIELD} font-semibold`} />
          </Field>
          <Field>
            <FieldLabel htmlFor="legalName">Legal name</FieldLabel>
            <Input id="legalName" name="legalName" defaultValue={legalName ?? ""} placeholder="Registered company name" className={PROFILE_FIELD} />
          </Field>
          <Field>
            <FieldLabel htmlFor="registrationNumber">Registration number</FieldLabel>
            <Input id="registrationNumber" name="registrationNumber" defaultValue={registrationNumber ?? ""} className={`${PROFILE_FIELD} font-mono tracking-wide`} />
          </Field>
          <Field>
            <FieldLabel htmlFor="countryCode">Country</FieldLabel>
            <CountrySearchSelect id="countryCode" name="countryCode" defaultValue={countryCode ?? undefined} placeholder="Select country" className={`${PROFILE_FIELD} text-sm`} />
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection title="Contact">
        <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="contactEmail">Contact email <Required /></FieldLabel>
            <Input id="contactEmail" name="contactEmail" type="email" autoComplete="email" defaultValue={contactEmail} required className={PROFILE_FIELD} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactPhone">Contact phone</FieldLabel>
            <PhoneInput id="contactPhone" name="contactPhone" defaultValue={contactPhone ?? undefined} defaultCountry={countryCode ?? "SO"} placeholder="61 234 5678" className={PROFILE_FIELD} />
          </Field>
          <Field>
            <FieldLabel htmlFor="website">Website</FieldLabel>
            <Input id="website" name="website" type="url" autoComplete="url" defaultValue={website ?? ""} placeholder="https://" className={PROFILE_FIELD} />
          </Field>
          <Field>
            <FieldLabel htmlFor="address">Office address</FieldLabel>
            <Input id="address" name="address" autoComplete="street-address" defaultValue={address ?? ""} placeholder="Street, district, city" className={PROFILE_FIELD} />
          </Field>
        </div>
      </ProfileSection>

      <ProfileSection title="About">
        <Field>
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="about">About the agency</FieldLabel>
            <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{aboutLength}/{ABOUT_LIMIT}</span>
          </div>
          <Textarea
            id="about"
            name="about"
            rows={4}
            maxLength={ABOUT_LIMIT}
            defaultValue={about ?? ""}
            onChange={(event) => setAboutLength(event.target.value.length)}
            className="min-h-28 rounded-xl border-transparent bg-secondary/70 px-3.5 py-3 shadow-none focus-visible:bg-card"
          />
        </Field>
      </ProfileSection>

      <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 rounded-b-2xl bg-card/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-end sm:px-7">
        <FieldError className="sm:mr-auto">{state?.error}</FieldError>
        {state?.error === null ? (
          <p role="status" className="flex items-center gap-2 text-sm font-medium sm:mr-auto">
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden="true">
              <Check className="size-3" strokeWidth={3} />
            </span>
            Profile updated.
          </p>
        ) : null}
        <SubmitButton size="lg" pendingText="Saving…" className="h-11 rounded-full px-6 max-sm:w-full">
          Save changes
        </SubmitButton>
      </div>
    </form>
  );
}
