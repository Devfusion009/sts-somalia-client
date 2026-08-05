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
import { requestFlightQuote } from "@/modules/flights/actions";
import type { FlightSearchDefaults } from "./flight-search-form";

/**
 * Manual quote flow: pre-filled from the search the visitor just ran; STS
 * staff reply with fare options. Signed-out visitors are sent to log in.
 */
export function QuoteRequestForm({
  defaults,
  signedIn,
}: {
  defaults: FlightSearchDefaults;
  signedIn: boolean;
}) {
  const [state, formAction] = useActionState(requestFlightQuote, null);

  if (!signedIn) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Sign in to request a personalised fare quote from our team.
        </p>
        <Button render={<Link href="/login" />}>Log in to request a quote</Button>
      </div>
    );
  }

  if (state && state.error === null && state.success) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl bg-primary/10 p-8 text-center">
        <CheckCircle2 className="size-8 text-primary" />
        <p className="font-heading text-lg font-bold">Quote request received!</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Our travel team is searching fares for your route and will send you options within a few
          hours. You can also reach us on{" "}
          <a href="tel:+252611444420" className="font-medium text-primary">
            +252 611 444 420
          </a>
          .
        </p>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Contact phone</Label>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            placeholder="+252 61 XXXXXXX"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="notes">Anything else we should know? (optional)</Label>
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
          <AlertCircle />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <SubmitButton pendingText="Sending request…" className="gap-2">
        <PhoneCall className="size-4" /> Request a Quote
      </SubmitButton>
    </form>
  );
}
