"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { createHotel, updateHotel } from "@/modules/admin/actions";
import { AMENITIES, AMENITY_LABELS } from "@/modules/partner-applications/config";
import type { Database } from "@/lib/types/database.types";

type Hotel = Database["public"]["Tables"]["hotels"]["Row"] & {
  property_links?: Array<{ label: string; url: string; sort_order: number }>;
};

/** Same fixed vocabulary + checkbox-pill UI as the hotel partner application wizard's AmenitiesField (steps.tsx) — picking from a known list instead of free-typing keeps values consistent with AMENITY_LABELS lookups everywhere else (PillList on the partner console, public property pages). */
function AmenitiesField({ initial }: { initial: string[] }) {
  const [checked, setChecked] = useState<string[]>(initial);
  return (
    <div className="space-y-2">
      <Label>Facilities</Label>
      <div className="flex flex-wrap gap-2">
        {AMENITIES.map((a) => (
          <label
            key={a}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
          >
            <input
              type="checkbox"
              checked={checked.includes(a)}
              onChange={(e) => setChecked((prev) => (e.target.checked ? [...prev, a] : prev.filter((v) => v !== a)))}
            />
            {AMENITY_LABELS[a]}
          </label>
        ))}
      </div>
      <input type="hidden" name="amenities" value={checked.join(",")} />
    </div>
  );
}

function amenitiesList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((v) => String(v)) : [];
}

/** Inverse of parseLinks() in admin/actions.ts — prefills the textarea so re-saving without touching it doesn't wipe existing links. */
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
            <Pencil /> Edit
          </>
        ) : (
          <>
            <Plus /> Add hotel
          </>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <form action={formAction}>
          {hotel ? <input type="hidden" name="id" value={hotel.id} /> : null}
          <DialogHeader>
            <DialogTitle>{hotel ? "Edit hotel" : "Add hotel"}</DialogTitle>
            <DialogDescription>
              Shown on the public Hotels pages once published.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hotel-name">Name</Label>
                <Input id="hotel-name" name="name" defaultValue={hotel?.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-city">City</Label>
                <Input id="hotel-city" name="city" defaultValue={hotel?.city} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotel-description">Description</Label>
              <Textarea
                id="hotel-description"
                name="description"
                rows={3}
                defaultValue={hotel?.description ?? ""}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hotel-address">Address</Label>
                <Input id="hotel-address" name="addressLine" defaultValue={hotel?.address_line ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-country">Country code</Label>
                <Input
                  id="hotel-country"
                  name="countryCode"
                  maxLength={2}
                  defaultValue={hotel?.country_code ?? "SO"}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="hotel-star">Star rating</Label>
                <Input
                  id="hotel-star"
                  name="starRating"
                  type="number"
                  min={1}
                  max={5}
                  defaultValue={hotel?.star_rating ?? undefined}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-phone">Phone</Label>
                <Input id="hotel-phone" name="phone" type="tel" defaultValue={hotel?.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-email">Contact email</Label>
                <Input id="hotel-email" name="contactEmail" type="email" defaultValue={hotel?.contact_email ?? ""} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hotel-checkin">Check-in time</Label>
                <Input id="hotel-checkin" name="checkInTime" type="time" defaultValue={hotel?.check_in_time?.slice(0, 5) ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hotel-checkout">Check-out time</Label>
                <Input id="hotel-checkout" name="checkOutTime" type="time" defaultValue={hotel?.check_out_time?.slice(0, 5) ?? ""} />
              </div>
            </div>
            <AmenitiesField initial={amenitiesList(hotel?.amenities)} />
            <div className="space-y-2">
              <Label htmlFor="hotel-policies">Policies (cancellation, house rules, ...)</Label>
              <Textarea
                id="hotel-policies"
                name="policies"
                rows={3}
                defaultValue={hotel?.policies ?? ""}
                placeholder="Free cancellation up to 48 hours before check-in. No smoking. Pets not allowed."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hotel-links">Links (one per line: Label | URL)</Label>
              <Textarea
                id="hotel-links"
                name="links"
                rows={3}
                defaultValue={linksList(hotel?.property_links)}
                placeholder={"Website | https://example.so/\nWhatsApp | https://wa.me/252..."}
              />
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select name="partnerId" defaultValue={hotel?.partner_id ?? "none"}>
                <SelectTrigger className="w-full">
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
              <p className="text-xs text-muted-foreground">
                Which hotel partner this property belongs to — leave as STS (direct) for
                STS-managed manual inventory.
              </p>
            </div>
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Booking mode</Label>
                <Select name="bookingMode" defaultValue={hotel?.booking_mode ?? "manual"}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual — STS confirms every request</SelectItem>
                    <SelectItem value="instant">Instant — live availability</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select name="status" defaultValue={hotel?.status ?? "draft"}>
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
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingText="Saving…">{hotel ? "Save changes" : "Create"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
