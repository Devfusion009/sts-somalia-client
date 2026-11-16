"use client";

import { AgentMoney } from "@/components/portal/agent-money";


import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { createHotelBooking } from "@/modules/hotels/booking-actions";
import { createBatchBooking } from "@/modules/agencies/batch-booking-actions";
import type { AgencyMarkupRule } from "@/modules/agencies/markup";
import { money } from "@/lib/money";
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
  roomsLeft,
  defaults,
  guests = [],
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
  /** Units left for the dates the page loaded with — bounds the Rooms picker. */
  roomsLeft?: number;
  defaults?: { checkIn?: string; checkOut?: string; guests?: string };
  /** Lead guest per selected customer, as printed in their passport. */
  guests?: { id: string; name: string }[];
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
  const maxRooms = Math.max(1, Math.min(20, roomsLeft ?? 20));
  const roomOptions = Array.from({ length: maxRooms }, (_, index) => index + 1);

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

  const customerPays = net + margin;
  const grandTotal = customerPays * customerCount;
  const shortBy = bookingMode === "instant" ? grandTotal - available : 0;
  const nightsLabel = `${nights} night${nights === 1 ? "" : "s"} × ${numRooms} room${numRooms === 1 ? "" : "s"}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>Book</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{room.name}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="hotelId" value={hotelId} />
          <input type="hidden" name="roomId" value={room.id} />
          <input type="hidden" name="agencyCustomerId" value={agencyCustomerId} />
          <input type="hidden" name="vertical" value="hotel" />
          <input type="hidden" name="desk" value="1" />

          <FieldGroup className="gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor={`checkIn-${room.id}`}>Check-in</FieldLabel>
                <Input
                  id={`checkIn-${room.id}`}
                  name="checkIn"
                  type="date"
                  required
                  value={checkIn}
                  onChange={(event) => setCheckIn(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`checkOut-${room.id}`}>Check-out</FieldLabel>
                <Input
                  id={`checkOut-${room.id}`}
                  name="checkOut"
                  type="date"
                  required
                  min={checkIn || undefined}
                  value={checkOut}
                  onChange={(event) => setCheckOut(event.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field>
                <FieldLabel htmlFor={`numRooms-${room.id}`}>Rooms</FieldLabel>
                <Select
                  name="numRooms"
                  value={String(numRooms)}
                  onValueChange={(value) => setNumRooms(Number(value))}
                >
                  <SelectTrigger id={`numRooms-${room.id}`} className="w-full tabular-nums">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roomOptions.map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor={`numAdults-${room.id}`}>Adults</FieldLabel>
                <Input
                  id={`numAdults-${room.id}`}
                  name="numAdults"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={30}
                  defaultValue={defaults?.guests || 1}
                  className="tabular-nums"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`numChildren-${room.id}`}>Children</FieldLabel>
                <Input
                  id={`numChildren-${room.id}`}
                  name="numChildren"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={30}
                  defaultValue={0}
                  className="tabular-nums"
                />
              </Field>
            </div>

            {isGroup ? (
              <Field>
                <FieldLabel>Lead guests</FieldLabel>
                {/* Each customer's booking carries their own name. */}
                {guests.map((guest) => (
                  <input key={guest.id} type="hidden" name={`c_${guest.id}__guestNames`} value={guest.name} />
                ))}
                <ul className="flex flex-wrap gap-1.5">
                  {guests.map((guest) => (
                    <li key={guest.id} className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium">{guest.name}</li>
                  ))}
                </ul>
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor={`guestNames-${room.id}`}>Guest names</FieldLabel>
                <Textarea
                  id={`guestNames-${room.id}`}
                  name="guestNames"
                  rows={2}
                  defaultValue={guests[0]?.name}
                  placeholder="One name per line"
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor={`specialRequests-${room.id}`}>Special requests</FieldLabel>
              <Textarea id={`specialRequests-${room.id}`} name="specialRequests" rows={2} />
            </Field>
          </FieldGroup>

          {nights > 0 ? (
            <dl className="space-y-1.5 rounded-lg bg-secondary/40 px-4 py-3 text-sm">
              {priceOnRequest ? (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted-foreground tabular-nums">
                    {nightsLabel}
                    {isGroup ? ` × ${customerCount}` : ""}
                  </dt>
                  <dd className="font-semibold">Price on request</dd>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground tabular-nums">Net · {nightsLabel}</dt>
                    <dd className="tabular-nums">{<AgentMoney value={money(net, room.currency)} />}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">Your margin</dt>
                    <dd className="tabular-nums">{<AgentMoney value={money(margin, room.currency)} />}</dd>
                  </div>
                  <div
                    className={cn(
                      "flex items-baseline justify-between gap-3 border-t border-border pt-1.5",
                      !isGroup && "font-semibold"
                    )}
                  >
                    <dt>{isGroup ? "Per customer" : "Customer pays"}</dt>
                    <dd className={cn("tabular-nums", !isGroup && "font-heading text-base")}>
                      {<AgentMoney value={money(customerPays, room.currency)} />}
                    </dd>
                  </div>
                  {isGroup ? (
                    <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5 font-semibold">
                      <dt className="tabular-nums">Total · {customerCount} customers</dt>
                      <dd className="font-heading text-base tabular-nums">{<AgentMoney value={money(grandTotal, room.currency)} />}</dd>
                    </div>
                  ) : null}
                  {shortBy > 0 ? (
                    <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5 text-destructive">
                      <dt className="font-medium">Short by</dt>
                      <dd className="font-semibold tabular-nums">{<AgentMoney value={money(shortBy, room.currency)} />}</dd>
                    </div>
                  ) : null}
                </>
              )}
            </dl>
          ) : null}

          <FieldError>{state?.error}</FieldError>

          <DialogFooter>
            {bookingMode === "instant" ? (
              <SubmitButton name="intent" value="hold" variant="outline" pendingText="Holding…">
                Hold 24h
              </SubmitButton>
            ) : null}
            <SubmitButton pendingText="Booking…">
              {isGroup
                ? `${bookingMode === "manual" ? "Send request" : "Confirm"} for ${customerCount} customers`
                : bookingMode === "manual"
                  ? "Send request"
                  : "Confirm booking"}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
