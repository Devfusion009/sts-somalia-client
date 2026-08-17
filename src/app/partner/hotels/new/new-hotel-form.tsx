"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { createHotel } from "@/modules/hotels/partner-actions";

export function NewHotelForm() {
  const [state, formAction] = useActionState(createHotel, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="name">Hotel name</Label>
        <Input id="name" name="name" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="countryCode">Country code</Label>
          <Input id="countryCode" name="countryCode" placeholder="SO" maxLength={2} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine">Address</Label>
        <Input id="addressLine" name="addressLine" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="starRating">Star rating</Label>
          <Input id="starRating" name="starRating" type="number" min={1} max={5} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          {/* Publishing is admin-only — STS reviews the listing (and your
              KYC) before it goes live to real customers. */}
          <Select name="status" defaultValue="draft">
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft — keep working on it</SelectItem>
              <SelectItem value="pending_review">Submit for review</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <SubmitButton pendingText="Creating…">Create hotel</SubmitButton>
    </form>
  );
}
