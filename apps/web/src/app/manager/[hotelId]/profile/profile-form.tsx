"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="hotelId" value={hotel.id} />

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={5} defaultValue={hotel.description ?? ""} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="addressLine">Address</Label>
        <Input id="addressLine" name="addressLine" defaultValue={hotel.address_line ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={hotel.phone ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={hotel.contact_email ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="checkInTime">Check-in time</Label>
          <Input id="checkInTime" name="checkInTime" type="time" defaultValue={toTimeValue(hotel.check_in_time)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="checkOutTime">Check-out time</Label>
          <Input id="checkOutTime" name="checkOutTime" type="time" defaultValue={toTimeValue(hotel.check_out_time)} />
        </div>
      </div>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state && !state.error ? <p className="text-xs text-primary">Profile saved.</p> : null}

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
