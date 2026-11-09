"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { updateAgencyProfileAction } from "@/modules/agencies/settings-actions";

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

  return (
    <form action={formAction}>
      <FieldGroup>
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">
              Agency name <span className="text-destructive">*</span>
            </FieldLabel>
            <Input id="name" name="name" autoComplete="organization" defaultValue={name} className="font-semibold" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="legalName">Legal name</FieldLabel>
            <Input id="legalName" name="legalName" defaultValue={legalName ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="registrationNumber">Registration number</FieldLabel>
            <Input id="registrationNumber" name="registrationNumber" defaultValue={registrationNumber ?? ""} className="font-mono tracking-wide" />
          </Field>
          <Field>
            <FieldLabel htmlFor="countryCode">Country code</FieldLabel>
            <Input
              id="countryCode"
              name="countryCode"
              defaultValue={countryCode ?? ""}
              placeholder="e.g. SO"
              maxLength={2}
              autoComplete="country"
              className="font-semibold tracking-widest uppercase"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactEmail">
              Contact email <span className="text-destructive">*</span>
            </FieldLabel>
            <Input id="contactEmail" name="contactEmail" type="email" autoComplete="email" defaultValue={contactEmail} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactPhone">Contact phone</FieldLabel>
            <Input id="contactPhone" name="contactPhone" type="tel" autoComplete="tel" defaultValue={contactPhone ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="website">Website</FieldLabel>
            <Input id="website" name="website" type="url" autoComplete="url" defaultValue={website ?? ""} placeholder="https://" />
          </Field>
          <Field>
            <FieldLabel htmlFor="address">Office address</FieldLabel>
            <Input id="address" name="address" autoComplete="street-address" defaultValue={address ?? ""} />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="about">About the agency</FieldLabel>
            <Textarea id="about" name="about" rows={3} maxLength={600} defaultValue={about ?? ""} />
          </Field>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <FieldError className="sm:mr-auto">{state?.error}</FieldError>
          {state?.error === null ? (
            <p role="status" className="flex items-center gap-1.5 text-sm text-muted-foreground sm:mr-auto">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" /> Profile updated.
            </p>
          ) : null}
          <SubmitButton pendingText="Saving…" className="max-sm:w-full">
            Save changes
          </SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
