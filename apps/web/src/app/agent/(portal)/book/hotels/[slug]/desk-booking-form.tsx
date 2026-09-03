"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BedDouble } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { createHotelBooking } from "@/modules/hotels/booking-actions";
import { createBatchBooking } from "@/modules/agencies/batch-booking-actions";
import type { AgencyMarkupRule } from "@/modules/agencies/markup";
import { cn } from "@/lib/utils";

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut || checkOut <= checkIn) return 0;
  const ms = new Date(`${checkOut}T00:00:00Z`).getTime() - new Date(`${checkIn}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function DeskBookingForm({
  hotelId,
  room,
  bookingMode,
  agencyCustomerId,
  customerCount = 1,
  markup,
  available,
  defaults,
}: {
  hotelId: string;
  room: { id: string; name: string; base_price: number; currency: string; max_occupancy: number };
  bookingMode: "manual" | "instant";
  agencyCustomerId: string;
  /** Selected customers — each gets their own booking of this room and stay. */
  customerCount?: number;
  markup: AgencyMarkupRule | null;
  /** Agency balance plus credit line — the shortfall is shown before confirming, not at payment. */
  available: number;
  defaults?: { checkIn?: string; checkOut?: string; guests?: string };
}) {
  const isGroup = customerCount > 1;
  // Seeded manual hotels carry base_price 0 meaning "price on request" — STS
  // quotes the real rate when it confirms the request, so showing a computed
  // zero here would read as a free stay.
  const priceOnRequest = room.base_price === 0;
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    isGroup ? createBatchBooking : createHotelBooking,
    null
  );
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? "");
  const [numRooms, setNumRooms] = useState(1);
  const router = useRouter();

  // The action hands back a path rather than redirecting; see deskOrderPath.
  useEffect(() => {
    if (state?.destination) {
      router.push(state.destination);
    }
  }, [state, router]);

  const nights = nightsBetween(checkIn, checkOut);
  const net = room.base_price * nights * numRooms;
  const margin = markup
    ? markup.markupType === "percent"
      ? Math.round(((net * markup.value) / 100) * 100) / 100
      : markup.value
    : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Book</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BedDouble className="size-4 text-primary" /> {room.name}
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomId" value={room.id} />
          <input type="hidden" name="agencyCustomerId" value={agencyCustomerId} />
          <input type="hidden" name="vertical" value="hotel" />
          <input type="hidden" name="desk" value="1" />

          {state?.error ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`checkIn-${room.id}`}>Check-in</Label>
              <Input
                id={`checkIn-${room.id}`}
                name="checkIn"
                type="date"
                required
                value={checkIn}
                onChange={(event) => setCheckIn(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`checkOut-${room.id}`}>Check-out</Label>
              <Input
                id={`checkOut-${room.id}`}
                name="checkOut"
                type="date"
                required
                value={checkOut}
                onChange={(event) => setCheckOut(event.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor={`numRooms-${room.id}`}>Rooms</Label>
              <Input
                id={`numRooms-${room.id}`}
                name="numRooms"
                type="number"
                min={1}
                max={20}
                value={numRooms}
                onChange={(event) => setNumRooms(Number(event.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`numAdults-${room.id}`}>Adults</Label>
              <Input
                id={`numAdults-${room.id}`}
                name="numAdults"
                type="number"
                min={1}
                max={30}
                defaultValue={defaults?.guests || 1}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`numChildren-${room.id}`}>Children</Label>
              <Input
                id={`numChildren-${room.id}`}
                name="numChildren"
                type="number"
                min={0}
                max={30}
                defaultValue={0}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`guestNames-${room.id}`}>Guest names</Label>
            <Textarea
              id={`guestNames-${room.id}`}
              name="guestNames"
              rows={2}
              placeholder="One name per line"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`specialRequests-${room.id}`}>Special requests</Label>
            <Textarea id={`specialRequests-${room.id}`} name="specialRequests" rows={2} />
          </div>

          {nights > 0 && priceOnRequest ? (
            <dl className="rounded-lg bg-secondary/40 px-3 py-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  {nights} night{nights === 1 ? "" : "s"} × {numRooms}
                  {isGroup ? ` × ${customerCount}` : ""}
                </dt>
                <dd className="font-semibold">Price on request</dd>
              </div>
            </dl>
          ) : nights > 0 ? (
            <dl className="space-y-1 rounded-lg bg-secondary/40 px-3 py-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Net · {nights} night{nights === 1 ? "" : "s"} × {numRooms}
                </dt>
                <dd className="tabular-nums">
                  {room.currency} {net.toFixed(0)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Your margin</dt>
                <dd className="tabular-nums">
                  {room.currency} {margin.toFixed(0)}
                </dd>
              </div>
              <div
                className={cn(
                  "flex justify-between border-t border-border pt-1",
                  isGroup ? "" : "font-semibold"
                )}
              >
                <dt>Customer pays</dt>
                <dd className="tabular-nums">
                  {room.currency} {(net + margin).toFixed(0)}
                </dd>
              </div>
              {isGroup ? (
                <div className="flex justify-between border-t border-border pt-1 font-semibold">
                  <dt>Total · {customerCount} customers</dt>
                  <dd className="tabular-nums">
                    {room.currency} {((net + margin) * customerCount).toFixed(0)}
                  </dd>
                </div>
              ) : null}
              {bookingMode === "instant" && (net + margin) * customerCount > available ? (
                <div className="flex justify-between border-t border-border pt-1 text-destructive">
                  <dt className="font-medium">Short by</dt>
                  <dd className="font-semibold tabular-nums">
                    {room.currency} {((net + margin) * customerCount - available).toFixed(0)}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          <div className="space-y-2">
            <SubmitButton className="w-full" pendingText="Booking…">
              {isGroup
                ? `${bookingMode === "manual" ? "Send request" : "Confirm"} for ${customerCount} customers`
                : bookingMode === "manual"
                  ? "Send request"
                  : "Confirm booking"}
            </SubmitButton>
            {bookingMode === "instant" ? (
              <SubmitButton
                name="intent"
                value="hold"
                variant="outline"
                className="w-full"
                pendingText="Holding…"
              >
                Hold 24h
              </SubmitButton>
            ) : null}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
