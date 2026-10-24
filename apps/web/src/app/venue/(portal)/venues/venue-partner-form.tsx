"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { createMyVenue, updateMyVenue, type ActionState } from "@/modules/events/venue-partner-actions";
import { NATIVE_SELECT_CLASS } from "@/components/ui/native-select";

export type EditableVenue = {
  id: string;
  name: string;
  city: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  capacity_seated: number | null;
  capacity_standing: number | null;
  size_sqm: number | null;
  event_types: unknown;
  base_price: number;
  currency: string;
  price_unit: string;
  status: string;
};

/**
 * Partner-side venue create/edit — the Venue Portal counterpart of the admin
 * console's VenueForm, with one deliberate difference: no "published" option.
 * Partners draft and submit for review; only staff publish to the public
 * catalog. A venue already published keeps its status on edit (the server
 * action refuses to regress it).
 */
export function VenuePartnerForm({ venue }: { venue?: EditableVenue }) {
  const [open, setOpen] = useState(false);
  const action = venue ? updateMyVenue : createMyVenue;
  const [state, formAction] = useActionState(
    async (prev: ActionState, formData: FormData) => {
      const result = await action(prev, formData);
      if (result && result.error === null) setOpen(false);
      return result;
    },
    null
  );

  const eventTypes = Array.isArray(venue?.event_types) ? (venue!.event_types as string[]).join(", ") : "";
  const editableStatus = !venue || ["draft", "pending_review"].includes(venue.status);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {venue ? (
        <DialogTrigger render={<Button size="icon" variant="ghost" aria-label={`Edit ${venue.name}`} title="Edit" />}>
          <Pencil />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus aria-hidden="true" /> Add venue
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <form action={formAction}>
          {venue ? <input type="hidden" name="venueId" value={venue.id} /> : null}
          <DialogHeader>
            <DialogTitle>{venue ? "Edit venue" : "Add venue"}</DialogTitle>
          </DialogHeader>

          <FieldGroup className="gap-4 py-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="vp-name">Name</FieldLabel>
                <Input id="vp-name" name="name" defaultValue={venue?.name} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="vp-city">City</FieldLabel>
                <Input id="vp-city" name="city" defaultValue={venue?.city} required />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="vp-tagline">Tagline</FieldLabel>
              <Input id="vp-tagline" name="tagline" defaultValue={venue?.tagline ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="vp-description">Description</FieldLabel>
              <Textarea id="vp-description" name="description" rows={3} defaultValue={venue?.description ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="vp-address">Address</FieldLabel>
              <Input id="vp-address" name="address" defaultValue={venue?.address ?? ""} />
            </Field>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="vp-seated">Seated capacity</FieldLabel>
                <Input
                  id="vp-seated"
                  name="capacitySeated"
                  type="number"
                  min="1"
                  className="tabular-nums"
                  defaultValue={venue?.capacity_seated ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="vp-standing">Standing capacity</FieldLabel>
                <Input
                  id="vp-standing"
                  name="capacityStanding"
                  type="number"
                  min="1"
                  className="tabular-nums"
                  defaultValue={venue?.capacity_standing ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="vp-size">Size (m²)</FieldLabel>
                <Input
                  id="vp-size"
                  name="sizeSqm"
                  type="number"
                  min="1"
                  step="0.1"
                  className="tabular-nums"
                  defaultValue={venue?.size_sqm ?? ""}
                />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="vp-types">Suitable events</FieldLabel>
              <Input id="vp-types" name="eventTypes" defaultValue={eventTypes} placeholder="wedding, conference, graduation" />
            </Field>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="vp-price">Base price</FieldLabel>
                <Input
                  id="vp-price"
                  name="basePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  className="tabular-nums"
                  defaultValue={venue?.base_price ?? ""}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="vp-currency">Currency</FieldLabel>
                <Input id="vp-currency" name="currency" className="uppercase" defaultValue={venue?.currency ?? "USD"} maxLength={3} />
              </Field>
              <Field className="col-span-2 sm:col-span-1">
                <FieldLabel htmlFor="vp-unit">Priced</FieldLabel>
                <select id="vp-unit" name="priceUnit" defaultValue={venue?.price_unit ?? "per_event"} className={NATIVE_SELECT_CLASS}>
                  <option value="per_event">Per event</option>
                  <option value="per_day">Per day</option>
                  <option value="per_hour">Per hour</option>
                  <option value="per_person">Per person</option>
                </select>
              </Field>
            </div>

            {editableStatus ? (
              <Field className="sm:max-w-[50%]">
                <FieldLabel htmlFor="vp-status">Status</FieldLabel>
                <select
                  id="vp-status"
                  name="status"
                  defaultValue={venue?.status === "pending_review" ? "pending_review" : "draft"}
                  className={NATIVE_SELECT_CLASS}
                >
                  <option value="draft">Draft</option>
                  <option value="pending_review">Submit for review</option>
                </select>
              </Field>
            ) : (
              // Published/suspended venues keep their status; a hidden valid value
              // satisfies the schema and the server ignores it for these rows.
              <input type="hidden" name="status" value="draft" />
            )}
          </FieldGroup>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{venue ? "Save changes" : "Create venue"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
