"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SubmitButton } from "@/components/submit-button";
import { createMyVenue, updateMyVenue, type ActionState } from "@/modules/events/venue-partner-actions";

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

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
      <DialogTrigger render={<Button size={venue ? "sm" : "default"} variant={venue ? "outline" : "default"} />}>
        {venue ? (
          <>
            <Pencil /> Edit
          </>
        ) : (
          <>
            <Plus /> Add venue
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{venue ? "Edit venue" : "Add venue"}</DialogTitle>
          <DialogDescription>
            Submitted venues are reviewed by STS staff before appearing on the public Events &amp; Halls pages.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          {venue ? <input type="hidden" name="venueId" value={venue.id} /> : null}
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vp-name">Name *</Label>
              <Input id="vp-name" name="name" defaultValue={venue?.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vp-city">City *</Label>
              <Input id="vp-city" name="city" defaultValue={venue?.city} required />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vp-tagline">Tagline</Label>
            <Input id="vp-tagline" name="tagline" defaultValue={venue?.tagline ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vp-description">Description</Label>
            <Textarea id="vp-description" name="description" rows={3} defaultValue={venue?.description ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vp-address">Address</Label>
            <Input id="vp-address" name="address" defaultValue={venue?.address ?? ""} />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vp-seated">Seated capacity</Label>
              <Input id="vp-seated" name="capacitySeated" type="number" min="1" defaultValue={venue?.capacity_seated ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vp-standing">Standing capacity</Label>
              <Input id="vp-standing" name="capacityStanding" type="number" min="1" defaultValue={venue?.capacity_standing ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vp-size">Size (m²)</Label>
              <Input id="vp-size" name="sizeSqm" type="number" min="1" step="0.1" defaultValue={venue?.size_sqm ?? ""} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vp-types">Suitable events (comma-separated)</Label>
            <Input id="vp-types" name="eventTypes" defaultValue={eventTypes} placeholder="wedding, conference, graduation" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="vp-price">Base price *</Label>
              <Input id="vp-price" name="basePrice" type="number" min="0" step="0.01" defaultValue={venue?.base_price ?? ""} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vp-currency">Currency</Label>
              <Input id="vp-currency" name="currency" defaultValue={venue?.currency ?? "USD"} maxLength={3} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vp-unit">Priced</Label>
              <select id="vp-unit" name="priceUnit" defaultValue={venue?.price_unit ?? "per_event"} className={selectClass}>
                <option value="per_event">per event</option>
                <option value="per_day">per day</option>
                <option value="per_hour">per hour</option>
                <option value="per_person">per person</option>
              </select>
            </div>
          </div>

          {editableStatus ? (
            <div className="space-y-1.5">
              <Label htmlFor="vp-status">Status</Label>
              <select
                id="vp-status"
                name="status"
                defaultValue={venue?.status === "pending_review" ? "pending_review" : "draft"}
                className={selectClass}
              >
                <option value="draft">Draft — keep working on it</option>
                <option value="pending_review">Submit for review</option>
              </select>
            </div>
          ) : (
            // Published/suspended venues keep their status; a hidden valid value
            // satisfies the schema and the server ignores it for these rows.
            <input type="hidden" name="status" value="draft" />
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{venue ? "Save changes" : "Create venue"}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
