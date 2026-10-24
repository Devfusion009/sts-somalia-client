"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { updateVenueProfileAsManager } from "@/modules/events/venue-manager-actions";

type VenueProfile = {
  id: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  contact_email: string | null;
  policies: string | null;
};

export function ManagerVenueProfileForm({ venue }: { venue: VenueProfile }) {
  const [state, formAction] = useActionState(updateVenueProfileAsManager, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="venueId" value={venue.id} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="tagline">Tagline</FieldLabel>
          <Input id="tagline" name="tagline" maxLength={160} defaultValue={venue.tagline ?? ""} />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea id="description" name="description" rows={5} defaultValue={venue.description ?? ""} />
        </Field>

        <Field>
          <FieldLabel htmlFor="address">Address</FieldLabel>
          <Input id="address" name="address" defaultValue={venue.address ?? ""} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input id="phone" name="phone" type="tel" defaultValue={venue.phone ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={venue.contact_email ?? ""} />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="policies">House rules &amp; policies</FieldLabel>
          <Textarea id="policies" name="policies" rows={4} defaultValue={venue.policies ?? ""} />
        </Field>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
          <FieldError className="mr-auto">{state?.error}</FieldError>
          {state && !state.error ? (
            <p role="status" className="mr-auto text-sm text-muted-foreground">
              Profile saved.
            </p>
          ) : null}
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
