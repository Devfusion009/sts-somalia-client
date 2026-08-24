"use client";

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
import { trpc } from "@/lib/trpc/react";
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
  const utils = trpc.useUtils();
  const save = trpc.travelers.saveSelf.useMutation({
    onSuccess: () => {
      utils.travelers.selfTraveler.invalidate();
      utils.travelers.myTravelers.invalidate();
    },
  });

  // async + awaited mutateAsync (not the fire-and-forget .mutate()) so
  // SubmitButton's useFormStatus()-based pending state tracks the mutation's
  // actual duration — same reasoning as every prior phase's converted form.
  async function handleSubmit(formData: FormData) {
    try {
      await save.mutateAsync({
        fullName: formData.get("fullName") as string,
        // Not rendered here (showRelationship={false}) — the backend
        // force-sets "self" regardless, but the schema still requires a
        // valid enum value to pass validation before that override.
        relationship: "self",
        dateOfBirth: (formData.get("dateOfBirth") as string) || undefined,
        gender: (formData.get("gender") as string) || undefined,
        nationality: (formData.get("nationality") as string) || undefined,
        passportNumber: (formData.get("passportNumber") as string) || undefined,
        passportIssueDate: (formData.get("passportIssueDate") as string) || undefined,
        passportExpiry: (formData.get("passportExpiry") as string) || undefined,
        notes: (formData.get("notes") as string) || undefined,
      });
    } catch {
      // handled via save.error below
    }
  }

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
        <form action={handleSubmit} className="space-y-4">
          {save.error ? (
            <Alert variant="destructive">
              <AlertDescription>{save.error.message}</AlertDescription>
            </Alert>
          ) : null}
          {save.isSuccess ? (
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
