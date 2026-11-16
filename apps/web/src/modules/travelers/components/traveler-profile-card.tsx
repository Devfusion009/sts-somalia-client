"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const router = useRouter();
  const utils = trpc.useUtils();
  const save = trpc.travelers.saveSelf.useMutation({
    onSuccess: () => {
      utils.travelers.selfTraveler.invalidate();
      utils.travelers.myTravelers.invalidate();
      toast.success("Passport details saved.");
      router.refresh();
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
        <CardTitle>Passport details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-5">
          <TravelerFields
            traveler={traveler}
            idPrefix="self"
            showRelationship={false}
            nameLabel="Full name (as in passport)"
          />

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {save.error ? (
              <p role="alert" className="text-sm text-destructive sm:mr-auto">
                {save.error.message}
              </p>
            ) : null}
            <SubmitButton pendingText="Saving…">Save passport details</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
