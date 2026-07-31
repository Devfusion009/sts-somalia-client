"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
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
import { updateHotel } from "@/lib/actions/hotel-partner";

type Hotel = {
  id: string;
  name: string;
  description: string | null;
  star_rating: number | null;
  address_line: string | null;
  city: string;
  country_code: string;
  status: string;
};

export function EditHotelForm({ hotel }: { hotel: Hotel }) {
  const [state, formAction] = useActionState(updateHotel, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="hotelId" value={hotel.id} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state && !state.error ? (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>Hotel updated.</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="name">Hotel name</Label>
        <Input id="name" name="name" defaultValue={hotel.name} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={hotel.description ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={hotel.city} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="countryCode">Country code</Label>
          <Input id="countryCode" name="countryCode" maxLength={2} defaultValue={hotel.country_code} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="addressLine">Address</Label>
        <Input id="addressLine" name="addressLine" defaultValue={hotel.address_line ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="starRating">Star rating</Label>
          <Input id="starRating" name="starRating" type="number" min={1} max={5} defaultValue={hotel.star_rating ?? undefined} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={hotel.status}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending_review">Pending review</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
