"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { updateHotelProfileAsManager } from "@/modules/hotels/manager-actions";

type HotelProfile = {
  id: string;
  description: string | null;
  address_line: string | null;
  phone: string | null;
  contact_email: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
};

/** hh:mm from a time column's "hh:mm:ss" — the input type="time" value shape. */
function toTimeValue(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

export function ManagerHotelProfileForm({ hotel }: { hotel: HotelProfile }) {
  const [state, formAction] = useActionState(updateHotelProfileAsManager, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="hotelId" value={hotel.id} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea id="description" name="description" rows={5} defaultValue={hotel.description ?? ""} />
        </Field>

        <Field>
          <FieldLabel htmlFor="addressLine">Address</FieldLabel>
          <Input id="addressLine" name="addressLine" defaultValue={hotel.address_line ?? ""} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <Input id="phone" name="phone" type="tel" defaultValue={hotel.phone ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={hotel.contact_email ?? ""} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <Field>
            <FieldLabel htmlFor="checkInTime">Check-in time</FieldLabel>
            <Input id="checkInTime" name="checkInTime" type="time" defaultValue={toTimeValue(hotel.check_in_time)} className="tabular-nums" />
          </Field>
          <Field>
            <FieldLabel htmlFor="checkOutTime">Check-out time</FieldLabel>
            <Input id="checkOutTime" name="checkOutTime" type="time" defaultValue={toTimeValue(hotel.check_out_time)} className="tabular-nums" />
          </Field>
        </div>

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
