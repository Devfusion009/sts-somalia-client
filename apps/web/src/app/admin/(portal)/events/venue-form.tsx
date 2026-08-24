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
import { Label } from "@/components/ui/label";
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
import { createVenue, updateVenue } from "@/modules/admin/actions";
import type { Database } from "@/lib/types/database.types";

type Venue = Database["public"]["Tables"]["event_venues"]["Row"] & {
  property_links?: Array<{ label: string; url: string; sort_order: number }>;
};

function jsonList(raw: unknown): string {
  return Array.isArray(raw) ? raw.map((v) => String(v).replace(/_/g, " ")).join(", ") : "";
}

/** Inverse of parseLinks() in listing-fields.ts — prefills the textarea so re-saving without touching it doesn't wipe existing links. */
function linksList(links: Venue["property_links"]): string {
  if (!links || links.length === 0) return "";
  return [...links]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((l) => `${l.label} | ${l.url}`)
    .join("\n");
}

export function VenueForm({ venue }: { venue?: Venue }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = venue ? updateVenue : createVenue;
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
        render={<Button size={venue ? "sm" : "default"} variant={venue ? "outline" : "default"} />}
      >
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <form action={formAction}>
          {venue ? <input type="hidden" name="id" value={venue.id} /> : null}
          <DialogHeader>
            <DialogTitle>{venue ? "Edit venue" : "Add venue"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="venue-name">Name</Label>
                <Input id="venue-name" name="name" defaultValue={venue?.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue-city">City</Label>
                <Input id="venue-city" name="city" defaultValue={venue?.city} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-tagline">Tagline</Label>
              <Input id="venue-tagline" name="tagline" defaultValue={venue?.tagline ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-description">Description</Label>
              <Textarea
                id="venue-description"
                name="description"
                rows={3}
                defaultValue={venue?.description ?? ""}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="venue-address">Address</Label>
                <Input id="venue-address" name="address" defaultValue={venue?.address ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue-phone">Phone</Label>
                <Input id="venue-phone" name="phone" type="tel" defaultValue={venue?.phone ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-email">Contact email</Label>
              <Input id="venue-email" name="contactEmail" type="email" defaultValue={venue?.contact_email ?? ""} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="venue-seated">Seated capacity</Label>
                <Input
                  id="venue-seated"
                  name="capacitySeated"
                  type="number"
                  min={1}
                  defaultValue={venue?.capacity_seated ?? undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue-standing">Standing capacity</Label>
                <Input
                  id="venue-standing"
                  name="capacityStanding"
                  type="number"
                  min={1}
                  defaultValue={venue?.capacity_standing ?? undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue-size">Size (m²)</Label>
                <Input
                  id="venue-size"
                  name="sizeSqm"
                  type="number"
                  min={0}
                  step="0.1"
                  defaultValue={venue?.size_sqm ?? undefined}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-amenities">Amenities (comma-separated)</Label>
              <Textarea
                id="venue-amenities"
                name="amenities"
                rows={2}
                defaultValue={jsonList(venue?.amenities)}
                placeholder="stage, sound system, catering kitchen, parking"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-event-types">Suitable events (comma-separated)</Label>
              <Input
                id="venue-event-types"
                name="eventTypes"
                defaultValue={jsonList(venue?.event_types)}
                placeholder="wedding, conference, graduation"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-policies">Policies (cancellation, deposit, ...)</Label>
              <Textarea
                id="venue-policies"
                name="policies"
                rows={3}
                defaultValue={venue?.policies ?? ""}
                placeholder="50% deposit to confirm. Free cancellation up to 7 days before the event."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-links">Links (one per line: Label | URL)</Label>
              <Textarea id="venue-links" name="links" rows={3} defaultValue={linksList(venue?.property_links)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="venue-price">Base price</Label>
                <Input
                  id="venue-price"
                  name="basePrice"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={venue?.base_price}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue-currency">Currency</Label>
                <Input
                  id="venue-currency"
                  name="currency"
                  maxLength={3}
                  defaultValue={venue?.currency ?? "USD"}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Priced</Label>
                <Select name="priceUnit" defaultValue={venue?.price_unit ?? "per_event"}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_event">Per event</SelectItem>
                    <SelectItem value="per_day">Per day</SelectItem>
                    <SelectItem value="per_hour">Per hour</SelectItem>
                    <SelectItem value="per_person">Per person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select name="status" defaultValue={venue?.status ?? "draft"}>
                  <SelectTrigger className="w-full">
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
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  name="isFeatured"
                  defaultChecked={venue?.is_featured ?? false}
                  className="size-4 accent-primary"
                />
                Featured venue
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{venue ? "Save changes" : "Create"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
