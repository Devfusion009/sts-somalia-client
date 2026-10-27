"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { WhatsAppInlineLink } from "@/components/marketing/whatsapp-button";
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
  venueName,
  currency,
  basePrice,
  priceUnit,
  eventTypes,
  maxGuests,
  bookedForSlot,
  action,
}: {
  venueId: string;
  venueName: string;
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
      // Every priced booking goes straight to checkout. Desk submissions
      // land on the desk order page instead, since a browser redirect into
      // the agent portal from here would land on the wrong host.
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
  // A venue without a price is not bookable online.
  const isRequestFirst = basePrice === 0;
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

  const required = <span className="text-destructive">*</span>;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="venueId" value={venueId} />
      {bookedForSlot}

      <FieldGroup className="gap-4">
        <div className="grid grid-cols-1 gap-4 @md/field-group:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="eventType">Event type {required}</FieldLabel>
            <Select name="eventType">
              <SelectTrigger id="eventType" className="w-full">
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
          </Field>

          <Field>
            <FieldLabel htmlFor="eventName">Event name (optional)</FieldLabel>
            <Input id="eventName" name="eventName" placeholder="e.g. Ahmed & Amina's Wedding" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="startDate">Start date {required}</FieldLabel>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              min={today}
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="endDate">End date {required}</FieldLabel>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              min={startDate || today}
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="startTime">
              Start time {priceUnit === "per_hour" ? required : null}
            </FieldLabel>
            <Input
              id="startTime"
              name="startTime"
              type="time"
              required={priceUnit === "per_hour"}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="endTime">
              End time {priceUnit === "per_hour" ? required : null}
            </FieldLabel>
            <Input
              id="endTime"
              name="endTime"
              type="time"
              required={priceUnit === "per_hour"}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </Field>
        </div>

        <Field className="@md/field-group:max-w-[calc(50%-0.5rem)]">
          <FieldLabel htmlFor="expectedGuests">
            Expected guests{maxGuests ? ` (max ${maxGuests})` : ""} {required}
          </FieldLabel>
          <Input
            id="expectedGuests"
            name="expectedGuests"
            type="number"
            inputMode="numeric"
            min={1}
            max={maxGuests ?? undefined}
            value={guests}
            onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            required
            className="tabular-nums"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="setupRequirements">Setup requirements (optional)</FieldLabel>
          <Textarea
            id="setupRequirements"
            name="setupRequirements"
            rows={3}
            placeholder="Stage layout, decor, catering preferences, AV needs…"
          />
        </Field>
      </FieldGroup>

      <Separator />

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            {isRequestFirst ? (
              <p className="font-heading text-lg font-semibold">Price on request</p>
            ) : (
              <>
                {!price.needsTimes ? (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {price.unitNoun
                      ? `${venueMoney(currency, price.unitPrice)} × ${formatUnitQuantity(price.quantity, price.unitNoun)}`
                      : "Venue fee"}
                  </p>
                ) : null}
                <p className="font-heading text-xl font-bold tabular-nums text-primary">
                  {venueMoney(currency, price.needsTimes ? price.unitPrice : price.total)}
                  {price.needsTimes ? (
                    <span className="text-xs font-normal text-muted-foreground"> per hour</span>
                  ) : null}
                </p>
              </>
            )}
          </div>
          {isRequestFirst ? (
            <WhatsAppInlineLink
              message={`Hello, I would like a price for ${venueName}.`}
              className={buttonVariants({ size: "lg", variant: "outline", className: "max-sm:w-full" })}
            >
              Ask for price
            </WhatsAppInlineLink>
          ) : (
            <SubmitButton
              pendingText="Reserving…"
              size="lg"
              className="max-sm:w-full"
              disabled={price.needsTimes}
            >
              Reserve &amp; pay <ArrowRight data-icon="inline-end" aria-hidden="true" />
            </SubmitButton>
          )}
        </div>
        <FieldError>{state?.error}</FieldError>
      </div>
    </form>
  );
}
