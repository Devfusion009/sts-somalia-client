"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
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
import { trpc } from "@/lib/trpc/react";
import { computeHallPrice, createHallBookingSchema } from "@sts/shared-types";
import { eventTypeLabel, venueMoney } from "./amenities";

export type ActionState = { error: string | null; destination?: string; orderId?: string } | null;

/** "3 days", "1 day", "6 hours" — the multiplied quantity for a price breakdown line. */
function formatUnitQuantity(quantity: number, unitNoun: "guest" | "day" | "hour" | null) {
  if (!unitNoun) return null;
  return `${quantity} ${unitNoun}${quantity > 1 ? "s" : ""}`;
}

function parseBookingForm(formData: FormData) {
  return createHallBookingSchema.safeParse({
    venueId: formData.get("venueId"),
    eventType: formData.get("eventType"),
    eventName: formData.get("eventName")?.toString().trim() || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    startTime: formData.get("startTime")?.toString() || undefined,
    endTime: formData.get("endTime")?.toString() || undefined,
    expectedGuests: formData.get("expectedGuests"),
    setupRequirements: formData.get("setupRequirements")?.toString().trim() || undefined,
    agencyCustomerId: formData.get("agencyCustomerId")?.toString() || undefined,
    newCustomerName: formData.get("newCustomerName")?.toString() || undefined,
    newCustomerPhone: formData.get("newCustomerPhone")?.toString() || undefined,
  });
}

export function HallBookingForm({
  venueId,
  currency,
  basePrice,
  priceUnit,
  eventTypes,
  maxGuests,
  bookedForSlot,
  action,
}: {
  venueId: string;
  currency: string;
  basePrice: number;
  priceUnit: string;
  eventTypes: string[];
  maxGuests: number | null;
  bookedForSlot?: React.ReactNode;
  /** The agent desk swaps in its group action, which books for every selected customer. */
  action?: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const createBooking = trpc.events.createHallBooking.useMutation();

  async function submitBooking(_prevState: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = parseBookingForm(formData);
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    try {
      const result = await createBooking.mutateAsync(parsed.data);
      // Per-person and price-on-request venues confirm the final price
      // before the booking completes — the request lands in the admin
      // queue and the customer pays from their booking page once the price
      // is confirmed. Fixed-price venues go straight to checkout. Desk
      // submissions always land on the desk order page instead, since a
      // browser redirect into the agent portal from here would land on the
      // wrong host.
      const isDesk = formData.get("desk") === "1";
      const destination = isDesk
        ? `/agent/book/order/${result.orderId}`
        : result.requiresPriceConfirmation
          ? `/account/bookings/${result.orderId}?requested=1`
          : `/checkout/${result.orderId}`;
      return { error: null, destination, orderId: result.orderId };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Could not create the booking.",
      };
    }
  }

  const [state, formAction] = useActionState(action ?? submitBooking, null);
  const [guests, setGuests] = useState(Math.min(100, maxGuests ?? 100));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const router = useRouter();
  // Local date, so the picker doesn't offer yesterday east of UTC.
  const [today] = useState(() => new Date().toLocaleDateString("en-CA"));

  // Desk submissions get a path back instead of a redirect, because a Server
  // Action redirect into the agent portal lands on the wrong host.
  useEffect(() => {
    if (state?.destination) {
      router.push(state.destination);
    }
  }, [state, router]);

  const options = eventTypes.length > 0 ? eventTypes : ["wedding", "conference", "other"];
  const perPerson = priceUnit === "per_person";
  // Per-person and price-on-request venues confirm the final price before the
  // booking completes — the request is sent without payment.
  const isRequestFirst = perPerson || basePrice === 0;
  // Single source of truth for the price shown here and the price charged —
  // apps/api's booking write calls this same function.
  const price = computeHallPrice({
    basePrice,
    priceUnit,
    expectedGuests: guests,
    startDate,
    endDate,
    startTime,
    endTime,
  });

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
            min={today}
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">End Date <span className="text-destructive">*</span></Label>
          <Input
            id="endDate"
            name="endDate"
            type="date"
            min={startDate || today}
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startTime">
            Start Time {priceUnit === "per_hour" ? <span className="text-destructive">*</span> : null}
          </Label>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            required={priceUnit === "per_hour"}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endTime">
            End Time {priceUnit === "per_hour" ? <span className="text-destructive">*</span> : null}
          </Label>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            required={priceUnit === "per_hour"}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="expectedGuests">
          Expected Guests{maxGuests ? ` (max ${maxGuests})` : ""} <span className="text-destructive">*</span>
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

      {/* Per-person and price-on-request venues estimate/confirm before the
          booking completes, so the request goes in WITHOUT payment.
          Fixed-price venues keep the pay-now flow. */}
      {isRequestFirst ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/60 p-3">
            {!price.onRequest ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {venueMoney(currency, price.unitPrice)} × {formatUnitQuantity(price.quantity, price.unitNoun)}
                </p>
                <p className="font-heading text-xl font-bold text-primary">
                  {venueMoney(currency, price.total)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">estimated</span>
                </p>
              </div>
            ) : (
              <p className="text-sm font-medium">Price on request</p>
            )}
          </div>
          <SubmitButton pendingText="Sending request…" className="w-full gap-1.5">
            Request Booking <ArrowRight className="size-4" />
          </SubmitButton>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              {!price.needsTimes ? (
                <p className="text-xs text-muted-foreground">
                  {price.unitNoun
                    ? `${venueMoney(currency, price.unitPrice)} × ${formatUnitQuantity(price.quantity, price.unitNoun)}`
                    : "Venue fee"}
                </p>
              ) : null}
              <p className="font-heading text-xl font-bold text-primary">
                {venueMoney(currency, price.needsTimes ? price.unitPrice : price.total)}
                {price.needsTimes ? (
                  <span className="text-xs font-normal text-muted-foreground"> per hour</span>
                ) : null}
              </p>
            </div>
            <SubmitButton pendingText="Reserving…" className="gap-1.5" disabled={price.needsTimes}>
              Reserve &amp; Pay <ArrowRight className="size-4" />
            </SubmitButton>
          </div>
        </div>
      )}
    </form>
  );
}
