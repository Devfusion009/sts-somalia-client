"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { createHotel, updateHotel } from "@/modules/admin/actions";
import { uploadHotelLogoAdmin, removeHotelLogoAdmin } from "@/modules/admin/hotel-logo-actions";
import { AmenitiesField, amenitiesList } from "@/modules/hotels/components/amenities-field";
import { PhoneField } from "@/modules/partner-applications/components/phone-field";
import { LocationField } from "@/components/location-field";
import { hotelLogoUrl } from "@/modules/hotels/images";
import { HotelLogoUploader } from "@/components/admin/hotel-logo-uploader";
import type { Database } from "@/lib/types/database.types";

type Hotel = Database["public"]["Tables"]["hotels"]["Row"] & {
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

export function HotelForm({ hotel, partners }: { hotel?: Hotel; partners: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = hotel ? updateHotel : createHotel;
  const [state, formAction] = useActionState(action, null);

  // Derived during render (not an effect) per React's guidance for reacting
  // to a state change — refs can't be read/written during render.
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setOpen(false);
  }
  useEffect(() => {
    if (state && !state.error) router.refresh();
  }, [state, router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size={hotel ? "sm" : "default"} variant={hotel ? "outline" : "default"} />}
      >
        {hotel ? (
          <>
            <Pencil aria-hidden="true" /> Edit
          </>
        ) : (
          <>
            <Plus aria-hidden="true" /> Add hotel
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{hotel ? "Edit hotel" : "Add hotel"}</DialogTitle>
        </DialogHeader>

        {hotel ? (
          <Field className="border-b border-border pb-4">
            <FieldLabel>Logo</FieldLabel>
            <HotelLogoUploader
              hotelId={hotel.id}
              logoUrl={hotelLogoUrl(hotel.logo_path)}
              uploadAction={uploadHotelLogoAdmin}
              removeAction={removeHotelLogoAdmin}
            />
          </Field>
        ) : null}

        <form action={formAction}>
          {hotel ? <input type="hidden" name="id" value={hotel.id} /> : null}

          <FieldGroup className="gap-4 py-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="hotel-name">Name</FieldLabel>
                <Input id="hotel-name" name="name" defaultValue={hotel?.name} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="hotel-city">City</FieldLabel>
                <LocationField id="hotel-city" name="city" defaultValue={hotel?.city} required />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="hotel-description">Description</FieldLabel>
              <Textarea id="hotel-description" name="description" rows={3} defaultValue={hotel?.description ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="hotel-description-so">Description (Somali)</FieldLabel>
              <Textarea
                id="hotel-description-so"
                name="descriptionSo"
                rows={3}
                defaultValue={hotel?.description_so ?? ""}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
              <Field>
                <FieldLabel htmlFor="hotel-address">Address</FieldLabel>
                <Input id="hotel-address" name="addressLine" defaultValue={hotel?.address_line ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="hotel-country">Country code</FieldLabel>
                <Input
                  id="hotel-country"
                  name="countryCode"
                  maxLength={2}
                  className="uppercase"
                  defaultValue={hotel?.country_code ?? "SO"}
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[8rem_1fr]">
              <Field>
                <FieldLabel htmlFor="hotel-star">Star rating</FieldLabel>
                <Input
                  id="hotel-star"
                  name="starRating"
                  type="number"
                  min={1}
                  max={5}
                  className="tabular-nums"
                  defaultValue={hotel?.star_rating ?? undefined}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="hotel-email">Contact email</FieldLabel>
                <Input id="hotel-email" name="contactEmail" type="email" defaultValue={hotel?.contact_email ?? ""} />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="hotel-phone">Phone</FieldLabel>
              <PhoneField name="phone" defaultValue={hotel?.phone ?? ""} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="hotel-checkin">Check-in</FieldLabel>
                <Input id="hotel-checkin" name="checkInTime" type="time" defaultValue={hotel?.check_in_time?.slice(0, 5) ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="hotel-checkout">Check-out</FieldLabel>
                <Input id="hotel-checkout" name="checkOutTime" type="time" defaultValue={hotel?.check_out_time?.slice(0, 5) ?? ""} />
              </Field>
            </div>
            <AmenitiesField initial={amenitiesList(hotel?.amenities)} />
            <Field>
              <FieldLabel htmlFor="hotel-policies">Policies</FieldLabel>
              <Textarea
                id="hotel-policies"
                name="policies"
                rows={3}
                placeholder="Cancellation, house rules"
                defaultValue={hotel?.policies ?? ""}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="hotel-links">Links</FieldLabel>
              <Textarea
                id="hotel-links"
                name="links"
                rows={3}
                placeholder="Website | https://example.com"
                defaultValue={linksList(hotel?.property_links)}
              />
            </Field>
            <Field>
              <FieldLabel>Owner</FieldLabel>
              <Select name="partnerId" defaultValue={hotel?.partner_id ?? "none"}>
                <SelectTrigger className="w-full" aria-label="Owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">STS (direct)</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select name="status" defaultValue={hotel?.status ?? "draft"}>
                  <SelectTrigger className="w-full" aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_review">Pending review</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{hotel ? "Save changes" : "Create hotel"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
