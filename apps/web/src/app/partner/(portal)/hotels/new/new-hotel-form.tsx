"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { PhoneField } from "@/modules/partner-applications/components/phone-field";
import { AmenitiesField } from "@/modules/hotels/components/amenities-field";
import { LocationField } from "@/components/location-field";
import { createHotel } from "@/modules/hotels/partner-actions";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export function NewHotelForm() {
  const [state, formAction] = useActionState(createHotel, null);

  return (
    <form action={formAction}>
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">Hotel name</FieldLabel>
            <Input id="name" name="name" required />
          </Field>
          <Field>
            <FieldLabel htmlFor="city">City</FieldLabel>
            <LocationField id="city" name="city" required />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea id="description" name="description" rows={4} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <Field>
            <FieldLabel htmlFor="addressLine">Address</FieldLabel>
            <Input id="addressLine" name="addressLine" />
          </Field>
          <Field>
            <FieldLabel htmlFor="countryCode">Country code</FieldLabel>
            <Input
              id="countryCode"
              name="countryCode"
              placeholder="SO"
              maxLength={2}
              defaultValue="SO"
              required
              className="uppercase"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <PhoneField id="phone" name="phone" />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
            <Input id="contactEmail" name="contactEmail" type="email" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="starRating">Star rating</FieldLabel>
            <Input id="starRating" name="starRating" type="number" min={1} max={5} className="tabular-nums" />
          </Field>
          <Field>
            <FieldLabel htmlFor="checkInTime">Check-in</FieldLabel>
            <Input id="checkInTime" name="checkInTime" type="time" className="tabular-nums" />
          </Field>
          <Field>
            <FieldLabel htmlFor="checkOutTime">Check-out</FieldLabel>
            <Input id="checkOutTime" name="checkOutTime" type="time" className="tabular-nums" />
          </Field>
        </div>

        <AmenitiesField initial={[]} />

        <Field>
          <FieldLabel htmlFor="policies">Policies</FieldLabel>
          <Textarea id="policies" name="policies" rows={3} placeholder="Cancellation, house rules" />
        </Field>

        <Field>
          <FieldLabel htmlFor="links">Links</FieldLabel>
          <Textarea id="links" name="links" rows={3} placeholder={"Official site | https://example.com"} />
        </Field>

        <Field className="sm:max-w-xs">
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <select id="status" name="status" defaultValue="draft" className={NATIVE_SELECT_CLASS}>
            <option value="draft">Draft</option>
            <option value="pending_review">Submit for review</option>
          </select>
        </Field>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
          <FieldError className="mr-auto">{state?.error}</FieldError>
          <SubmitButton pendingText="Creating…">Create hotel</SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
