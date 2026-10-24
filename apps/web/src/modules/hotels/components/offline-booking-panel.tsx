"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { CalendarPlus, PhoneCall, Globe, CircleCheck, CircleAlert, CircleX, CalendarX2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge, statusBadgeVariant } from "@/components/ui/badge";
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { dateSpan, money } from "@/lib/money";
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
        <Empty className="p-6">
          <EmptyMedia variant="icon">
            <CalendarX2 />
          </EmptyMedia>
          <EmptyTitle>No live bookings</EmptyTitle>
        </Empty>
      ) : (
        <ul className="divide-y divide-border">
          {bookings.map((b) => (
            <li key={b.id} className="space-y-1 py-2.5 text-sm first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium tabular-nums">{dateSpan(b.check_in, b.check_out)}</span>
                <Badge variant={statusBadgeVariant(b.status)} className="capitalize">
                  {b.status.replace(/_/g, " ")}
                </Badge>
                <Badge variant="outline">
                  {b.source === "offline" ? <PhoneCall aria-hidden="true" /> : <Globe aria-hidden="true" />}
                  {b.source === "offline" ? "Offline" : "Online"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {b.guestName ?? "Guest"} · {b.num_rooms} room{b.num_rooms > 1 ? "s" : ""} · {b.num_adults} adult
                {b.num_adults > 1 ? "s" : ""}
                {b.num_children > 0 ? `, ${b.num_children} child${b.num_children > 1 ? "ren" : ""}` : ""}
              </p>
              {b.special_requests ? <p className="text-xs text-muted-foreground">{b.special_requests}</p> : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit && newBookingHref ? (
        <div className="border-t border-border pt-4">
          <Button className="w-full" render={<Link href={newBookingHref} />}>
            <CalendarPlus aria-hidden="true" /> Record offline booking
          </Button>
        </div>
      ) : canEdit ? (
        <form key={formKey} action={formAction} className="space-y-4 border-t border-border pt-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomTypeId" value={roomTypeId} />

          <Field>
            <div className="flex items-baseline justify-between gap-2">
              <FieldLabel htmlFor="offRoomType">Room type</FieldLabel>
              {selectedRoomType ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {money(selectedRoomType.basePrice, selectedRoomType.currency)} / night
                </span>
              ) : null}
            </div>
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
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="offCheckIn">Check-in</FieldLabel>
              <Input
                id="offCheckIn"
                name="checkIn"
                type="date"
                min={today}
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="offCheckOut">Check-out</FieldLabel>
              <Input
                id="offCheckOut"
                name="checkOut"
                type="date"
                min={checkIn || today}
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                required
              />
            </Field>
          </div>

          {available !== null ? (
            <p
              role="status"
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium tabular-nums",
                willWaitlist
                  ? available <= 0
                    ? "text-destructive"
                    : "text-[color-mix(in_oklch,var(--brand-gold),black_30%)] dark:text-brand-gold"
                  : "text-primary"
              )}
            >
              {available <= 0 ? (
                <>
                  <CircleX aria-hidden="true" className="size-4 shrink-0" /> Fully booked
                </>
              ) : willWaitlist ? (
                <>
                  <CircleAlert aria-hidden="true" className="size-4 shrink-0" /> {available} of {numRooms} rooms available
                </>
              ) : (
                <>
                  <CircleCheck aria-hidden="true" className="size-4 shrink-0" /> {available} room{available > 1 ? "s" : ""} available
                </>
              )}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="offGuestName">Guest name</FieldLabel>
              <Input id="offGuestName" name="guestName" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="offGuestPhone">Phone</FieldLabel>
              <Input id="offGuestPhone" name="guestPhone" type="tel" />
            </Field>
          </div>
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Field>
              <FieldLabel htmlFor="offNumRooms">Rooms</FieldLabel>
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
                className="tabular-nums"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="offNotes">Notes</FieldLabel>
              <Textarea id="offNotes" name="notes" rows={1} className="min-h-8" />
            </Field>
          </div>

          <FieldError>{state?.error}</FieldError>

          <SubmitButton className="w-full" pendingText="Recording…">
            <CalendarPlus aria-hidden="true" /> {willWaitlist ? "Add to waitlist" : "Record offline booking"}
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
