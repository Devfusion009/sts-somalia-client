"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { trpc } from "@/lib/trpc/react";
import { requestFlightQuoteSchema } from "@sts/shared-types";
import type { FlightSearchDefaults } from "./flight-search-form";

type QuoteActionState = { error: string | null; success?: boolean } | null;

/**
 * Manual quote flow: pre-filled from the search the visitor just ran; STS
 * staff reply with fare options. Signed-out visitors are sent to log in.
 */
export function QuoteRequestForm({
  defaults,
  signedIn,
  bookedForSlot,
}: {
  defaults: FlightSearchDefaults;
  signedIn: boolean;
  bookedForSlot?: React.ReactNode;
}) {
  const requestQuote = trpc.flights.requestQuote.useMutation();

  async function submitQuote(
    _prev: QuoteActionState,
    formData: FormData
  ): Promise<QuoteActionState> {
    const parsed = requestFlightQuoteSchema.safeParse({
      origin: formData.get("origin")?.toString().toUpperCase(),
      destination: formData.get("destination")?.toString().toUpperCase(),
      departDate: formData.get("departDate"),
      returnDate: formData.get("returnDate")?.toString() || undefined,
      tripType: formData.get("tripType") ?? "one_way",
      cabinClass: formData.get("cabinClass") ?? "economy",
      adults: formData.get("adults") ?? 1,
      contactPhone: formData.get("contactPhone"),
      notes: formData.get("notes")?.toString().trim() || undefined,
      agencyCustomerId: formData.get("agencyCustomerId")?.toString() || undefined,
      newCustomerName: formData.get("newCustomerName")?.toString() || undefined,
      newCustomerPhone: formData.get("newCustomerPhone")?.toString() || undefined,
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    try {
      const result = await requestQuote.mutateAsync(parsed.data);
      if (result.error) return { error: result.error };
      return { error: null, success: true };
    } catch {
      return { error: "Could not send the quote request. Try again." };
    }
  }

  const [state, formAction] = useActionState(submitQuote, null);

  if (!signedIn) {
    return (
      <div className="flex justify-center">
        <Button size="lg" render={<Link href="/login" />}>
          Log in to request a quote
        </Button>
      </div>
    );
  }

  if (state && state.error === null && state.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-primary/10 p-8 text-center">
        <CheckCircle2 className="size-8 text-primary" aria-hidden />
        <p role="status" className="font-heading text-lg font-bold">
          Quote request sent.
        </p>
        <a
          href="tel:+252611444420"
          className="rounded-sm text-sm font-medium text-primary tabular-nums hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          +252 611 444 420
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="origin" value={defaults.origin ?? ""} />
      <input type="hidden" name="destination" value={defaults.destination ?? ""} />
      <input type="hidden" name="departDate" value={defaults.departDate ?? ""} />
      <input type="hidden" name="returnDate" value={defaults.returnDate ?? ""} />
      <input
        type="hidden"
        name="tripType"
        value={defaults.tripType === "one_way" ? "one_way" : "round_trip"}
      />
      <input type="hidden" name="cabinClass" value={defaults.cabin ?? "economy"} />
      <input type="hidden" name="adults" value={defaults.adults ?? "1"} />

      {bookedForSlot}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Contact phone</Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            autoComplete="tel"
            placeholder="+252 61 XXXXXXX"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">
            Anything else we should know? <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="Preferred airline, flexible dates, extra baggage…"
          />
        </div>
      </div>

      {state?.error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton size="lg" pendingText="Sending request…" className="gap-2 max-sm:w-full">
          <PhoneCall className="size-4" aria-hidden /> Request a quote
        </SubmitButton>
      </div>
    </form>
  );
}
