"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { CalendarPlus, PhoneCall, Globe, CircleCheck, CircleAlert, CircleX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { createFrontDeskBooking, type FrontDeskActionState } from "@/modules/hotels/front-desk-actions";
import type { RoomNight } from "@/modules/hotels/availability";
import { cn } from "@/lib/utils";

export type RoomBooking = {
  id: string;
  check_in: string;
  check_out: string;
  num_rooms: number;
  num_adults: number;
  num_children: number;
  status: string;
  source: string;
  guestName: string | null;
  special_requests: string | null;
  created_at: string;
};

export type RoomTypeOption = {
  id: string;
  name: string;
  currency: string;
  basePrice: number;
};

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "bg-destructive/10 text-destructive",
};

/** Lowest "available" across every night in [checkIn, checkOut) that this room type has data for. Null when the range is empty, unpicked, or outside the fetched window — never treated as a block. */
function minAvailable(nights: RoomNight[], checkIn: string, checkOut: string): number | null {
  if (!checkIn || !checkOut || checkOut <= checkIn) return null;
  const known = nights.filter(
    (n) => n.night >= checkIn && n.night < checkOut && n.capacity !== null && n.available !== null
  );
  if (known.length === 0) return null;
  return Math.min(...known.map((n) => n.available as number));
}

/**
 * Record an offline booking (phone/walk-in) and show every live booking
 * already holding its nights — the sync the online engine depends on: this
 * writes into the same hotel_bookings row an online booking would, through
 * the same capacity-allocator trigger, so a night taken here is immediately
 * unavailable online. No separate "blocked dates" tracker exists to fall out
 * of sync with this one.
 *
 * The room-type picker and the availability line both read from
 * availabilityByRoom — the same per-night numbers the "Next 60 nights" table
 * on this page shows — so switching room type or dates here can never
 * disagree with what the table says is actually left.
 */
export function OfflineBookingPanel({
  hotelId,
  roomTypes,
  defaultRoomTypeId,
  availabilityByRoom,
  bookings,
  canEdit,
  newBookingHref,
}: {
  hotelId: string;
  roomTypes: RoomTypeOption[];
  defaultRoomTypeId: string;
  availabilityByRoom: Record<string, RoomNight[]>;
  bookings: RoomBooking[];
  canEdit: boolean;
  /** When set, the form is replaced by a link to the full booking flow (guest + payment capture). */
  newBookingHref?: string;
}) {
  const [state, formAction] = useActionState<FrontDeskActionState, FormData>(createFrontDeskBooking, null);
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  const [roomTypeId, setRoomTypeId] = useState(defaultRoomTypeId);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [numRooms, setNumRooms] = useState(1);

  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) {
      setFormKey((k) => k + 1); // clears the form after a successful submit
      setCheckIn("");
      setCheckOut("");
      setNumRooms(1);
    }
  }

  const selectedRoomType = roomTypes.find((r) => r.id === roomTypeId);
  const available = useMemo(
    () => minAvailable(availabilityByRoom[roomTypeId] ?? [], checkIn, checkOut),
    [availabilityByRoom, roomTypeId, checkIn, checkOut]
  );
  // The allocator seats a request fully or not at all (see
  // hotel_inventory_priority_allocation.sql) — asking for more rooms than
  // are left waitlists the whole booking rather than erroring, so this never
  // blocks the submit button. It only makes the outcome unmistakable before
  // the click: enough rooms confirms, not enough goes to the waitlist.
  const willWaitlist = available !== null && available < numRooms;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live bookings for these nights.</p>
      ) : (
        <ul className="divide-y divide-border">
          {bookings.map((b) => {
            const guest = b.guestName;
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0 text-sm">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    {b.check_in} → {b.check_out}
                    <Badge className={cn("border-transparent capitalize", STATUS_STYLE[b.status] ?? "bg-muted text-muted-foreground")}>
                      {b.status}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      {b.source === "offline" ? <PhoneCall className="size-3" /> : <Globe className="size-3" />}
                      {b.source === "offline" ? "Offline" : "Online"}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {guest ?? "Guest"} · {b.num_rooms} room{b.num_rooms > 1 ? "s" : ""} · {b.num_adults} adult{b.num_adults > 1 ? "s" : ""}
                    {b.num_children > 0 ? `, ${b.num_children} child${b.num_children > 1 ? "ren" : ""}` : ""}
                  </p>
                  {b.special_requests ? <p className="text-xs text-muted-foreground">{b.special_requests}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && newBookingHref ? (
        <div className="border-t border-border pt-4">
          <Button className="w-full gap-1.5" render={<Link href={newBookingHref} />}>
            <CalendarPlus className="size-4" /> Record offline booking
          </Button>
        </div>
      ) : canEdit ? (
        <form key={formKey} action={formAction} className="space-y-3 border-t border-border pt-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomTypeId" value={roomTypeId} />
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="offRoomType">Room type</Label>
            <Select value={roomTypeId} onValueChange={(v) => setRoomTypeId(v ?? defaultRoomTypeId)}>
              <SelectTrigger id="offRoomType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roomTypes.map((rt) => (
                  <SelectItem key={rt.id} value={rt.id}>
                    {rt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRoomType ? (
              <p className="text-xs text-muted-foreground">
                {selectedRoomType.currency} {selectedRoomType.basePrice.toFixed(0)} / night
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="offCheckIn">Check-in</Label>
              <Input
                id="offCheckIn"
                name="checkIn"
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offCheckOut">Check-out</Label>
              <Input
                id="offCheckOut"
                name="checkOut"
                type="date"
                min={checkIn || today}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                required
              />
            </div>
          </div>

          {available !== null ? (
            <p
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium",
                willWaitlist ? (available <= 0 ? "text-destructive" : "text-brand-gold") : "text-primary"
              )}
            >
              {available <= 0 ? (
                <>
                  <CircleX className="size-4 shrink-0" /> Fully booked for these dates — this will go on the waitlist.
                </>
              ) : willWaitlist ? (
                <>
                  <CircleAlert className="size-4 shrink-0" /> Only {available} room{available > 1 ? "s" : ""} left, {numRooms} requested — this will go on the waitlist.
                </>
              ) : (
                <>
                  <CircleCheck className="size-4 shrink-0" /> {available} room{available > 1 ? "s" : ""} available for these dates.
                </>
              )}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="offGuestName">Guest name</Label>
              <Input id="offGuestName" name="guestName" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offGuestPhone">Phone</Label>
              <Input id="offGuestPhone" name="guestPhone" type="tel" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="offNumRooms">Rooms</Label>
              <Input
                id="offNumRooms"
                name="numRooms"
                type="number"
                min={1}
                max={20}
                value={numRooms}
                onChange={(e) => setNumRooms(Math.max(1, Number(e.target.value) || 1))}
                required
                aria-invalid={willWaitlist}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offNotes">Notes</Label>
              <Textarea id="offNotes" name="notes" rows={1} />
            </div>
          </div>

          <SubmitButton className="w-full gap-1.5" pendingText="Recording…">
            <CalendarPlus className="size-4" /> {willWaitlist ? "Add to waitlist" : "Record offline booking"}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
