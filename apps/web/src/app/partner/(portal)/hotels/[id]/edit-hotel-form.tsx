"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { PhoneField } from "@/modules/partner-applications/components/phone-field";
import { AmenitiesField, amenitiesList } from "@/modules/hotels/components/amenities-field";
import { LocationField } from "@/components/location-field";
import { updateHotel } from "@/modules/hotels/partner-actions";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

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
  const partnerEditableStatus = ["draft", "pending_review"].includes(hotel.status);

  return (
    <form action={formAction}>
      <input type="hidden" name="hotelId" value={hotel.id} />
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">Hotel name</FieldLabel>
            <Input id="name" name="name" defaultValue={hotel.name} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="city">City</FieldLabel>
            <LocationField id="city" name="city" defaultValue={hotel.city} required />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="description">Description</FieldLabel>
          <Textarea id="description" name="description" rows={4} defaultValue={hotel.description ?? ""} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-[1fr_8rem]">
          <Field>
            <FieldLabel htmlFor="addressLine">Address</FieldLabel>
            <Input id="addressLine" name="addressLine" defaultValue={hotel.address_line ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="countryCode">Country code</FieldLabel>
            <Input
              id="countryCode"
              name="countryCode"
              maxLength={2}
              defaultValue={hotel.country_code}
              required
              className="uppercase"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="phone">Phone</FieldLabel>
            <PhoneField id="phone" name="phone" defaultValue={hotel.phone ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={hotel.contact_email ?? ""} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="starRating">Star rating</FieldLabel>
            <Input
              id="starRating"
              name="starRating"
              type="number"
              min={1}
              max={5}
              defaultValue={hotel.star_rating ?? undefined}
              className="tabular-nums"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="checkInTime">Check-in</FieldLabel>
            <Input
              id="checkInTime"
              name="checkInTime"
              type="time"
              defaultValue={hotel.check_in_time?.slice(0, 5) ?? ""}
              className="tabular-nums"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="checkOutTime">Check-out</FieldLabel>
            <Input
              id="checkOutTime"
              name="checkOutTime"
              type="time"
              defaultValue={hotel.check_out_time?.slice(0, 5) ?? ""}
              className="tabular-nums"
            />
          </Field>
        </div>

        <AmenitiesField initial={amenitiesList(hotel.amenities)} />

        <Field>
          <FieldLabel htmlFor="policies">Policies</FieldLabel>
          <Textarea
            id="policies"
            name="policies"
            rows={3}
            placeholder="Cancellation, house rules"
            defaultValue={hotel.policies ?? ""}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="links">Links</FieldLabel>
          <Textarea
            id="links"
            name="links"
            rows={3}
            placeholder={"Official site | https://example.com"}
            defaultValue={linksList(hotel.property_links)}
          />
        </Field>

        <Field className="sm:max-w-xs">
          <FieldLabel htmlFor={partnerEditableStatus ? "status" : undefined}>Status</FieldLabel>
          {partnerEditableStatus ? (
            <select id="status" name="status" defaultValue={hotel.status} className={NATIVE_SELECT_CLASS}>
              <option value="draft">Draft</option>
              <option value="pending_review">Submit for review</option>
            </select>
          ) : (
            // Published/suspended is admin-only from here on — a hidden
            // valid value satisfies the schema and the server ignores it
            // for a hotel already past the partner's hands.
            <div className="flex h-8 items-center">
              <Badge variant={statusBadgeVariant(hotel.status)} className="capitalize" title="Set by STS">
                {hotel.status.replace(/_/g, " ")}
              </Badge>
              <input type="hidden" name="status" value="draft" />
            </div>
          )}
        </Field>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
          <FieldError className="mr-auto">{state?.error}</FieldError>
          {state && !state.error ? (
            <p role="status" className="mr-auto text-sm text-muted-foreground">
              Hotel saved.
            </p>
          ) : null}
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </div>
      </FieldGroup>
    </form>
  );
}
