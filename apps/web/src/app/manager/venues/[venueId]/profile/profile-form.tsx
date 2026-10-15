"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="venueId" value={venue.id} />

      <div className="space-y-1.5">
        <Label htmlFor="tagline">Tagline</Label>
        <Input id="tagline" name="tagline" maxLength={160} defaultValue={venue.tagline ?? ""} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={5} defaultValue={venue.description ?? ""} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Input id="address" name="address" defaultValue={venue.address ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={venue.phone ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={venue.contact_email ?? ""} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="policies">House rules &amp; policies</Label>
        <Textarea id="policies" name="policies" rows={4} defaultValue={venue.policies ?? ""} />
      </div>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state && !state.error ? <p className="text-xs text-primary">Profile saved.</p> : null}

      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
    </form>
  );
}
