"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { PhoneField } from "@/modules/partner-applications/components/phone-field";
import { AmenitiesField, amenitiesList } from "@/modules/hotels/components/amenities-field";
import { LocationField } from "@/components/location-field";
import { updateHotel } from "@/modules/hotels/partner-actions";

type Hotel = {
  id: string;
  name: string;
  description: string | null;
  star_rating: number | null;
  address_line: string | null;
  city: string;
  country_code: string;
  status: string;
  phone: string | null;
  contact_email: string | null;
  check_in_time: string | null;
  check_out_time: string | null;
  policies: string | null;
  amenities: unknown;
  property_links?: Array<{ label: string; url: string; sort_order: number }>;
};

/** Inverse of parseLinks() in listing-fields.ts — prefills the textarea so re-saving without touching it doesn't wipe existing links. */
function linksList(links: Hotel["property_links"]): string {
  if (!links || links.length === 0) return "";
  return [...links]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((l) => `${l.label} | ${l.url}`)
    .join("\n");
}

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Hotel name</Label>
          <Input id="name" name="name" defaultValue={hotel.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <LocationField id="city" name="city" defaultValue={hotel.city} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={hotel.description ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="addressLine">Address</Label>
          <Input id="addressLine" name="addressLine" defaultValue={hotel.address_line ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="countryCode">Country code</Label>
          <Input id="countryCode" name="countryCode" maxLength={2} defaultValue={hotel.country_code} required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="starRating">Star rating</Label>
          <Input id="starRating" name="starRating" type="number" min={1} max={5} defaultValue={hotel.star_rating ?? undefined} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Contact email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={hotel.contact_email ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <PhoneField name="phone" defaultValue={hotel.phone ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="checkInTime">Check-in time</Label>
          <Input id="checkInTime" name="checkInTime" type="time" defaultValue={hotel.check_in_time?.slice(0, 5) ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkOutTime">Check-out time</Label>
          <Input id="checkOutTime" name="checkOutTime" type="time" defaultValue={hotel.check_out_time?.slice(0, 5) ?? ""} />
        </div>
      </div>

      <AmenitiesField initial={amenitiesList(hotel.amenities)} />

      <div className="space-y-2">
        <Label htmlFor="policies">Policies (cancellation, house rules, ...)</Label>
        <Textarea id="policies" name="policies" rows={3} defaultValue={hotel.policies ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="links">Links (one per line: Label | URL)</Label>
        <Textarea id="links" name="links" rows={3} defaultValue={linksList(hotel.property_links)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        {["draft", "pending_review"].includes(hotel.status) ? (
          <Select name="status" defaultValue={hotel.status}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft — keep working on it</SelectItem>
              <SelectItem value="pending_review">Submit for review</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          // Published/suspended is admin-only from here on — a hidden
          // valid value satisfies the schema and the server ignores it
          // for a hotel already past the partner's hands.
          <div className="flex h-9 items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {hotel.status.replace(/_/g, " ")}
            </Badge>
            <span className="text-xs text-muted-foreground">Set by STS</span>
            <input type="hidden" name="status" value="draft" />
          </div>
        )}
      </div>

      <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}
