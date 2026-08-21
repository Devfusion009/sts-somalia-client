"use client";

import { useActionState } from "react";
import { CheckCircle2, IdCard } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SubmitButton } from "@/components/submit-button";
import { saveSelfTravelerAction } from "../actions";
import { TravelerFields } from "./traveler-fields";
import type { TravelerProfile } from "../queries";

/**
 * The account holder's own passport details, on the Profile section.
 *
 * Separate from ProfileForm (and a separate Server Action) because it writes a
 * different table with a different validator — contact details and travel
 * identity have different lifecycles, and merging them would mean one failed
 * passport-date check blocks a phone-number change.
 */
export function TravelerProfileCard({ traveler }: { traveler: TravelerProfile | null }) {
  const [state, formAction] = useActionState(saveSelfTravelerAction, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IdCard className="size-5 text-muted-foreground" />
          Traveler &amp; passport details
        </CardTitle>
        <CardDescription>
          Saved once and reused across visa applications, Umrah bookings and flight tickets, so you
          don&apos;t retype it each time.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state?.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          {state && !state.error ? (
            <Alert>
              <CheckCircle2 />
              <AlertDescription>Traveler details saved.</AlertDescription>
            </Alert>
          ) : null}

          <TravelerFields
            traveler={traveler}
            idPrefix="self"
            showRelationship={false}
            nameLabel="Full name (as printed in your passport)"
          />

          <SubmitButton pendingText="Saving…">Save traveler details</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
