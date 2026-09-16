"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, PhoneCall, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { createFrontDeskBooking, type FrontDeskActionState } from "@/modules/hotels/front-desk-actions";
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

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-primary/10 text-primary",
  pending: "bg-brand-gold/15 text-brand-gold",
  waitlisted: "bg-destructive/10 text-destructive",
};

/**
 * Record an offline booking (phone/walk-in) directly against this room
 * type, and show every live booking already holding its nights — the sync
 * the online engine depends on: this writes into the same hotel_bookings
 * row an online booking would, through the same capacity-allocator trigger,
 * so a night taken here is immediately unavailable online. No separate
 * "blocked dates" tracker exists to fall out of sync with this one.
 */
export function OfflineBookingPanel({
  hotelId,
  roomTypeId,
  bookings,
  canEdit,
}: {
  hotelId: string;
  roomTypeId: string;
  bookings: RoomBooking[];
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState<FrontDeskActionState, FormData>(createFrontDeskBooking, null);
  const [lastState, setLastState] = useState(state);
  const [formKey, setFormKey] = useState(0);
  if (state !== lastState) {
    setLastState(state);
    if (state && !state.error) setFormKey((k) => k + 1); // clears the form after a successful submit
  }
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

      {canEdit ? (
        <form key={formKey} action={formAction} className="space-y-3 border-t border-border pt-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomTypeId" value={roomTypeId} />
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="offCheckIn">Check-in</Label>
              <Input id="offCheckIn" name="checkIn" type="date" min={today} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offCheckOut">Check-out</Label>
              <Input id="offCheckOut" name="checkOut" type="date" min={today} required />
            </div>
          </div>
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
              <Input id="offNumRooms" name="numRooms" type="number" min={1} max={20} defaultValue={1} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offNotes">Notes</Label>
              <Textarea id="offNotes" name="notes" rows={1} />
            </div>
          </div>

          <SubmitButton className="w-full gap-1.5" pendingText="Recording…">
            <CalendarPlus className="size-4" /> Record offline booking
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
