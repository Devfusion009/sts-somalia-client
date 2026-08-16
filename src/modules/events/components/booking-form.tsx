"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowRight, CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/submit-button";
import { createHallBooking } from "@/modules/events/actions";
import { eventTypeLabel, priceUnitLabel } from "./amenities";

export function HallBookingForm({
  venueId,
  currency,
  basePrice,
  priceUnit,
  eventTypes,
  maxGuests,
  bookedForSlot,
}: {
  venueId: string;
  currency: string;
  basePrice: number;
  priceUnit: string;
  eventTypes: string[];
  maxGuests: number | null;
  bookedForSlot?: React.ReactNode;
}) {
  const [state, formAction] = useActionState(createHallBooking, null);
  const [guests, setGuests] = useState(100);
  const [startDate, setStartDate] = useState("");

  const options = eventTypes.length > 0 ? eventTypes : ["wedding", "conference", "other"];
  const perPerson = priceUnit === "per_person";
  // Per-person and price-on-request venues confirm the final price before the
  // booking completes — the request is sent without payment.
  const isRequestFirst = perPerson || basePrice === 0;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="venueId" value={venueId} />
      {bookedForSlot}

      <div className="space-y-1.5">
        <Label>Event Type <span className="text-destructive">*</span></Label>
        <Select name="eventType">
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            {options.map((type) => (
              <SelectItem key={type} value={type}>
                {eventTypeLabel(type)}
              </SelectItem>
            ))}
            {!options.includes("other") ? <SelectItem value="other">Other</SelectItem> : null}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="eventName">Event Name (optional)</Label>
        <Input id="eventName" name="eventName" placeholder="e.g. Ahmed & Amina's Wedding" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start Date <span className="text-destructive">*</span></Label>
          <Input
            id="startDate"
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">End Date <span className="text-destructive">*</span></Label>
          <Input id="endDate" name="endDate" type="date" min={startDate || undefined} required />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Multi-day events (e.g. setup through teardown) are supported — set the same date for both if it&apos;s a one-day event.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startTime">Start Time</Label>
          <Input id="startTime" name="startTime" type="time" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endTime">End Time</Label>
          <Input id="endTime" name="endTime" type="time" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expectedGuests">
          Expected Guests <span className="text-destructive">*</span>
        </Label>
        <Input
          id="expectedGuests"
          name="expectedGuests"
          type="number"
          min={1}
          max={maxGuests ?? undefined}
          value={guests}
          onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
          required
        />
        {maxGuests ? (
          <p className="text-xs text-muted-foreground">Up to {maxGuests} guests</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="setupRequirements">Setup Requirements (optional)</Label>
        <Textarea
          id="setupRequirements"
          name="setupRequirements"
          rows={3}
          placeholder="Stage layout, decor, catering preferences, AV needs…"
        />
      </div>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Separator />

      {/* Per-person venues estimate by headcount; the venue confirms the
          final price before the booking completes, so the request goes in
          WITHOUT payment. Fixed-price venues keep the pay-now flow. */}
      {isRequestFirst ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/60 p-3">
            {perPerson && basePrice > 0 ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {currency} {basePrice.toFixed(0)} per person × {guests} guest{guests > 1 ? "s" : ""}
                </p>
                <p className="font-heading text-xl font-bold text-primary">
                  {currency} {(basePrice * guests).toFixed(0)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">estimated</span>
                </p>
              </div>
            ) : (
              <p className="text-sm font-medium">Price on request</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              The venue confirms your final price before the booking is completed — you won&apos;t pay
              anything until then.
            </p>
          </div>
          <SubmitButton pendingText="Sending request…" className="w-full gap-1.5">
            Request Booking <ArrowRight className="size-4" />
          </SubmitButton>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Venue fee</p>
            <p className="font-heading text-xl font-bold text-primary">
              {currency} {basePrice.toFixed(0)}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                {priceUnitLabel(priceUnit)}
              </span>
            </p>
          </div>
          <SubmitButton pendingText="Reserving…" className="gap-1.5">
            Reserve &amp; Pay <ArrowRight className="size-4" />
          </SubmitButton>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="size-3.5" />
        Our events team confirms availability within one working day.
      </p>
    </form>
  );
}
